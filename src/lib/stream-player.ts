/**
 * Motor de reprodução unificado para streams de IPTV.
 *
 * Formatos suportados:
 * - HLS (.m3u8/.m3u): hls.js — H.264/AAC, H.265, VP9 (conforme suporte MSE do navegador)
 * - MPEG-TS progressivo (.ts): mpegts.js — H.264/H.265 + AAC/MP3
 * - MP4/WebM/OGG: reprodução nativa — inclui VP8/VP9 em WebM
 *
 * Tudo passa pelo relay `/api/public/stream-proxy` (mesmo domínio), o que
 * elimina bloqueios de conteúdo misto (HTTP em página HTTPS) e de CORS —
 * política de segurança do navegador que JavaScript não contorna sozinho.
 * URLs sem extensão passam por uma tentativa automática: HLS → MPEG-TS → nativo.
 */

export interface StreamCallbacks {
  onReady: () => void;
  onError: (reason: StreamErrorReason) => void;
}

export type StreamErrorReason =
  | "network" // falha de rede / servidor indisponível
  | "media" // codec ou container não suportado
  | "unsupported"
  | "mixed-content" // http:// em página https:// (só ocorre sem relay)
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

function detectKind(url: string): "hls" | "ts" | "native" | "unknown" {
  const clean = (url.split(/[?#]/)[0] ?? "").toLowerCase();
  if (clean.endsWith(".m3u8") || clean.endsWith(".m3u")) return "hls";
  if (clean.endsWith(".ts") || clean.endsWith(".mts") || clean.endsWith(".m2ts")) return "ts";
  if (/\.(mp4|m4v|webm|ogv|ogg|mov)$/.test(clean)) return "native";
  return "unknown";
}

export function proxyStreamUrl(url: string): string {
  return `/api/public/stream-proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Descobre o tipo real do stream quando a URL não tem extensão: lê o
 * content-type e os primeiros bytes pela resposta do relay. Sem isso,
 * um MPEG-TS ao vivo (infinito) seria lido como "manifesto" HLS e travaria.
 */
async function probeStreamKind(streamUrl: string): Promise<"hls" | "ts" | "native"> {
  try {
    const res = await fetch(streamUrl);
    if (!res.ok) {
      void res.body?.cancel().catch(() => {});
      return "ts"; // mpegts.js falha com mensagem de rede mais precisa
    }
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (/mpegurl|m3u/.test(ct)) {
      void res.body?.cancel().catch(() => {});
      return "hls";
    }
    if (/mp2t|mpegts/.test(ct)) {
      void res.body?.cancel().catch(() => {});
      return "ts";
    }
    const reader = res.body?.getReader();
    if (reader) {
      const first = await reader.read();
      void reader.cancel().catch(() => {});
      const bytes = first.done ? null : first.value;
      if (bytes) {
        const head = new TextDecoder().decode(bytes.subarray(0, 7)).trimStart();
        if (head.startsWith("#EXTM3U")) return "hls";
        // Sync byte do MPEG-TS: 0x47 no início e a cada 188 bytes.
        if (bytes[0] === 0x47 && (bytes.length < 189 || bytes[188] === 0x47)) return "ts";
      }
    }
    return "native";
  } catch {
    return "ts";
  }
}

export function attachStream(
  video: HTMLVideoElement,
  url: string,
  cb: StreamCallbacks,
): Cleanup {
  const kind = detectKind(url);
  const pageHttps =
    typeof window !== "undefined" && window.location.protocol === "https:";

  // Mídia nativa direta quando não há risco de conteúdo misto; todo o resto
  // (HLS, MPEG-TS, URL sem extensão) vai pelo relay do mesmo domínio.
  const nativeDirect = kind === "native" && !(pageHttps && url.startsWith("http://"));
  const streamUrl = nativeDirect ? url : proxyStreamUrl(url);

  let destroyed = false;
  let hlsRetries = 0;
  let tsRetries = 0;
  let hls: import("hls.js").default | null = null;
  let tsPlayer: MpegtsPlayer | null = null;

  const onPlaying = () => {
    if (!destroyed) cb.onReady();
  };
  let nativeActive = false;
  const onNativeError = () => {
    if (nativeActive && !destroyed) cb.onError("fatal");
  };
  video.addEventListener("playing", onPlaying);
  video.addEventListener("error", onNativeError);

  const play = () => {
    video.play().catch(() => {});
  };

  const teardownCurrentPlayer = () => {
    if (hls) {
      try {
        hls.destroy();
      } catch {
        /* noop */
      }
      hls = null;
    }
    if (tsPlayer) {
      try {
        tsPlayer.pause();
        tsPlayer.unload();
        tsPlayer.detachMediaElement();
        tsPlayer.destroy();
      } catch {
        /* noop */
      }
      tsPlayer = null;
    }
    video.pause();
    video.removeAttribute("src");
  };

  const attachNative = () => {
    nativeActive = true;
    video.src = streamUrl;
    video.play().catch(() => {});
  };

  const attachTs = async () => {
    const mpegtsModule = await import("mpegts.js");
    if (destroyed) return;
    const mpegts = mpegtsModule.default;

    if (!mpegts.isSupported()) {
      // <video> nativo não decodifica MPEG-TS: erro honesto em vez de falha
      // genérica tentando reproduzir direto.
      cb.onError("unsupported");
      return;
    }

    const player = mpegts.createPlayer(
      {
        type: "mpegts",
        isLive: true,
        url: streamUrl,
      },
      {
        enableStashBuffer: true,
        stashInitialSize: 384 * 1024,
        liveBufferLatencyChasing: true,
        autoCleanupSourceBuffer: true,
      },
    ) as unknown as MpegtsPlayer;
    tsPlayer = player;
    player.attachMediaElement(video);
    player.load();
    Promise.resolve(player.play()).catch(() => {});

    let errored = false;
    player.on(mpegts.Events.ERROR, (...args: unknown[]) => {
      if (destroyed || errored) return;
      errored = true;
      // mpegts.js repassa (errorType, errorMessage) — errorType é o valor do enum.
      const errorType = typeof args[0] === "string" ? args[0] : String(args[0] ?? "");
      console.debug("[ts] error", errorType);
      const isMedia =
        errorType === mpegts.ErrorTypes.MEDIA_ERROR || /media/i.test(errorType);
      // MPEG-TS falhou. Em URLs sem extensão ainda vale tentar a reprodução
      // nativa (pode ser um MP4 servido sem extensão); nos outros casos, erro.
      teardownCurrentPlayer();
      if (kind === "unknown" && !isMedia) attachNative();
      else cb.onError(isMedia ? "media" : "network");
    });
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
    hls.loadSource(streamUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      play();
    });

    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal || destroyed) return;

      // O "manifesto" não é HLS — em URLs sem extensão é quase sempre
      // MPEG-TS direto: troca de motor em vez de desistir.
      if (
        data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR &&
        kind === "unknown"
      ) {
        teardownCurrentPlayer();
        void attachTs();
        return;
      }

      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          if (hlsRetries < 3) {
            hlsRetries++;
            hls?.startLoad();
          } else if (kind === "unknown") {
            teardownCurrentPlayer();
            void attachTs();
          } else {
            cb.onError("network");
          }
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

  const start = async () => {
    if (kind === "hls") {
      await attachHls();
    } else if (kind === "ts") {
      await attachTs();
    } else if (kind === "native") {
      attachNative();
    } else {
      // Sem extensão: identifica o tipo real antes de escolher o motor —
      // adivinhar errado travava (stream TS ao vivo lido como manifesto HLS).
      const probed = await probeStreamKind(streamUrl);
      console.debug("[probe] result", probed);
      if (destroyed) return;
      if (probed === "hls") await attachHls();
      else if (probed === "ts") await attachTs();
      else attachNative();
    }
  };
  void start();

  return () => {
    destroyed = true;
    nativeActive = false;
    video.removeEventListener("playing", onPlaying);
    video.removeEventListener("error", onNativeError);
    teardownCurrentPlayer();
  };
}

export const STREAM_ERROR_MESSAGES: Record<StreamErrorReason, string> = {
  "mixed-content":
    "Este stream usa HTTP e a página é HTTPS — o navegador bloqueia conteúdo misto. Use um stream HTTPS.",
  network:
    "Falha de rede ao carregar o stream. O servidor pode estar offline, fora do ar ou bloqueando o acesso.",
  media: "O codec deste stream não é suportado pelo seu navegador.",
  unsupported: "Este formato de stream não é suportado pelo seu navegador.",
  fatal: "Não foi possível reproduzir este stream.",
};
