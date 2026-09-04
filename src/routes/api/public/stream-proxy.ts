import { createFileRoute } from "@tanstack/react-router";

/**
 * Relay de streams: reexpõe streams HTTP (e com CORS restritivo) pelo mesmo
 * domínio HTTPS do site, contornando bloqueio de conteúdo misto e CORS.
 *
 * - Manifestos HLS (.m3u8) são reescritos para que segmentos/variantes também
 *   passem pelo relay.
 * - Mídia (segmentos, MPEG-TS, MP4) é repassada em streaming, com Range.
 */

const USER_AGENT = "Vela.tv StreamProxy/1.0";
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "0.0.0.0" || host === "::1") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host) || /^0\./.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function proxyHref(target: string): string {
  return `/api/public/stream-proxy?url=${encodeURIComponent(target)}`;
}

function rewriteManifest(text: string, baseUrl: string): string {
  const lines = text.split("\n");
  const out = new Array<string>(lines.length);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.replace(/\r$/, "");
    if (!line) {
      out[i] = line;
      continue;
    }
    if (line.startsWith("#")) {
      out[i] = line.replace(/URI="([^"]*)"/g, (match, uri: string) => {
        if (!uri) return match;
        try {
          return `URI="${proxyHref(new URL(uri, baseUrl).href)}"`;
        } catch {
          return match;
        }
      });
    } else {
      try {
        out[i] = proxyHref(new URL(line.trim(), baseUrl).href);
      } catch {
        out[i] = line;
      }
    }
  }
  return out.join("\n");
}

export const Route = createFileRoute("/api/public/stream-proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Só o próprio site pode usar o relay (evita abuso como proxy aberto).
        const site = request.headers.get("sec-fetch-site");
        if (site && site !== "same-origin" && site !== "none") {
          return new Response("Forbidden", { status: 403 });
        }

        const targetParam = new URL(request.url).searchParams.get("url");
        if (!targetParam) return new Response("Missing url", { status: 400 });

        let target: URL;
        try {
          target = new URL(targetParam);
        } catch {
          return new Response("Invalid url", { status: 400 });
        }
        if (target.protocol !== "http:" && target.protocol !== "https:") {
          return new Response("Unsupported protocol", { status: 400 });
        }
        if (isPrivateHostname(target.hostname)) {
          return new Response("Forbidden", { status: 403 });
        }

        const range = request.headers.get("range");
        let upstream: Response;
        try {
          upstream = await fetch(target.href, {
            redirect: "follow",
            headers: {
              "User-Agent": USER_AGENT,
              Accept: "*/*",
              ...(range ? { Range: range } : {}),
            },
          });
        } catch {
          return new Response("Upstream unreachable", { status: 502 });
        }

        if (!upstream.ok) {
          return new Response(`Upstream error ${upstream.status}`, { status: 502 });
        }

        const contentType = upstream.headers.get("content-type") ?? "";
        const finalPath = (upstream.url || target.href).split(/[?#]/)[0]!.toLowerCase();
        const looksManifest =
          /mpegurl|m3u/i.test(contentType) ||
          finalPath.endsWith(".m3u8") ||
          finalPath.endsWith(".m3u");

        if (!upstream.body) {
          return new Response(null, {
            status: upstream.status,
            headers: { "cache-control": "no-store" },
          });
        }

        const reader = upstream.body.getReader();
        const first = await reader.read();
        if (first.done) {
          return new Response(null, {
            status: upstream.status,
            headers: { "cache-control": "no-store" },
          });
        }

        const headText = new TextDecoder().decode(first.value.subarray(0, 7)).trimStart();
        if (!looksManifest && !headText.startsWith("#EXTM3U")) {
          // Mídia (segmentos, MPEG-TS, MP4): repassa em streaming.
          const headers = new Headers({ "cache-control": "no-store" });
          if (contentType) headers.set("content-type", contentType);
          if (!upstream.headers.get("content-encoding")) {
            const len = upstream.headers.get("content-length");
            if (len) headers.set("content-length", len);
            const acceptRanges = upstream.headers.get("accept-ranges");
            if (acceptRanges) headers.set("accept-ranges", acceptRanges);
          }
          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(first.value);
            },
            async pull(controller) {
              try {
                const { done, value } = await reader.read();
                if (done) controller.close();
                else controller.enqueue(value!);
              } catch {
                controller.close();
              }
            },
            cancel() {
              void reader.cancel().catch(() => {});
            },
          });
          return new Response(stream, { status: upstream.status, headers });
        }

        // Manifesto HLS: lê por completo e reescreve as URLs para o relay.
        const chunks: Uint8Array[] = [first.value];
        let total = first.value.byteLength;
        let truncated = false;
        while (total < MAX_MANIFEST_BYTES) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          total += value.byteLength;
        }
        if (total >= MAX_MANIFEST_BYTES) {
          void reader.cancel().catch(() => {});
        }

        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        const text = new TextDecoder().decode(bytes);
        const manifest = rewriteManifest(text, upstream.url || target.href);
        return new Response(manifest, {
          status: upstream.status,
          headers: {
            "content-type": "application/vnd.apple.mpegurl",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
