/**
 * Motor de reprodução unificado para streams de IPTV.
 *
 * Formatos suportados:
 * - HLS (.m3u8/.m3u): hls.js — H.264/AAC, H.265, VP9 (conforme suporte MSE do navegador)
 * - MPEG-TS progressivo (.ts): mpegts.js — H.264/H.265 + AAC/MP3
 * - MP4/WebM/OGG: reprodução nativa — inclui VP8/VP9 em WebM
 *
 * Limitação: o navegador bloqueia certificados TLS autoassinados e conteúdo
 * HTTP misto em páginas HTTPS. Isso é uma política de segurança do navegador
 * e não pode ser contornada via JavaScript.
 */

export interface StreamCallbacks {
  onReady: () => void;
  onError: (reason: StreamErrorReason) => void;
}

export type StreamErrorReason =
  | "network" // falha de rede / CORS / TLS
  | "media" // codec ou container não suportado
  | "unsupported"
  | "mixed-content" // http:// em página https://
  | "fatal";

type Cleanup = () => void;

interface MpegtsPlayer {
  attachMediaElement(el: HTMLMediaElement): void;
  detachMediaElement(): void;
  load(): void;
  unload(): void;
  play(): Promise<void> | void;
  pause(): void;
  destroy(): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
}

function detectKind(url: string): "hls" | "ts" | "native" {
  const clean = (url.split(/[?#]/)[0] ?? "").toLowerCase();
  if (clean.endsWith(".m3u8") || clean.endsWith(".m3u")) return "hls";
  if (clean.endsWith(".ts") || clean.endsWith(".mts") || clean.endsWith(".m2ts")) return "ts";
  return "native";
}

export function attachStream(
  video: HTMLVideoElement,
  url: string,
  cb: StreamCallbacks,
): Cleanup {
  // Página HTTPS não consegue carregar stream HTTP: o navegador bloqueia antes
  // de qualquer biblioteca rodar.
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    url.startsWith("http://")
  ) {
    cb.onError("mixed-content");
    return () => {};
  }

  const kind = detectKind(url);
  let destroyed = false;

  const onPlaying = () => cb.onReady();
  const onVideoError = () => cb.onError("fatal");
  video.addEventListener("playing", onPlaying);
  video.addEventListener("error", onVideoError);

  let hls: import("hls.js").default | null = null;
  let tsPlayer: MpegtsPlayer | null = null;

  const attachNative = () => {
    video.src = url;
    video.play().catch(() => cb.onError("fatal"));
  };

  const attachHls = async () => {
    const Hls = (await import("hls.js")).default;
    if (destroyed) return;

    // Safari/iOS: HLS nativo
    if (!Hls.isSupported()) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        attachNative();
      } else {
        cb.onError("unsupported");
      }
      return;
    }

    hls = new Hls({
      enableWorker: true,
      // Tolerância a servidores de IPTV instáveis
      manifestLoadingMaxRetry: 4,
      manifestLoadingRetryDelay: 1000,
      levelLoadingMaxRetry: 6,
      levelLoadingRetryDelay: 1000,
      fragLoadingMaxRetry: 8,
      fragLoadingRetryDelay: 1000,
      // Aceita variações comuns de muxagem (AAC/ADTS, timestamps irregulares)
      enableSoftwareAES: true,
      stretchShortVideoTrack: true,
      maxAudioFramesDrift: 1,
    });
    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
    });

    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal || destroyed) return;
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          // Inclui falhas de TLS/CORS — o navegador não distingue para o JS.
          hls?.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          // Tenta recuperar (ex.: troca de codec no meio do stream)
          try {
            hls?.recoverMediaError();
          } catch {
            cb.onError("media");
          }
          break;
        default:
          cb.onError("fatal");
      }
    });
  };

  const attachTs = async () => {
    const mpegtsModule = await import("mpegts.js");
    if (destroyed) return;
    const mpegts = mpegtsModule.default;

    if (!mpegts.isSupported()) {
      cb.onError("unsupported");
      return;
    }

    mpegts = null; // garante limpeza anterior
    const player = mpegts.createPlayer(
      {
        type: "mpegts",
        isLive: true,
        url,
      },
      {
        enableStashBuffer: true,
        stashInitialSize: 384 * 1024,
        liveBufferLatencyChasing: true,
        autoCleanupSourceBuffer: true,
      },
    );
    mpegts = player;
    player.attachMediaElement(video);
    player.load();
    player.play().catch(() => cb.onError("fatal"));
    player.on(mpegts.Events.ERROR, () => cb.onError("network"));
  };

  if (kind === "hls") void attachHls();
  else if (kind === "ts") void attachTs();
  else attachNative();

  return () => {
    destroyed = true;
    video.removeEventListener("playing", onPlaying);
    video.removeEventListener("error", onVideoError);
    hls?.destroy();
    if (mpegts) {
      try {
        mpegts.pause();
        mpegts.unload();
        mpegts.detachMediaElement();
        mpegts.destroy();
      } catch {
        /* noop */
      }
    }
    video.pause();
    video.removeAttribute("src");
  };
}

export const STREAM_ERROR_MESSAGES: Record<StreamErrorReason, string> = {
  "mixed-content":
    "Este stream usa HTTP e a página é HTTPS — o navegador bloqueia conteúdo misto. Use um stream HTTPS.",
  network:
    "Falha de rede ao carregar o stream. Pode ser CORS ou um certificado TLS autoassinado, que o navegador bloqueia por segurança.",
  media: "O codec deste stream não é suportado pelo seu navegador.",
  unsupported: "Este formato de stream não é suportado pelo seu navegador.",
  fatal: "Não foi possível reproduzir este stream.",
};
