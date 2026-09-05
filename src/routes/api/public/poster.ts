import { createFileRoute } from "@tanstack/react-router";

/**
 * Reexpõe as capas (logos) das listas pelo mesmo domínio HTTPS do site.
 * Muitas capas ficam em servidores HTTP, que o navegador bloqueia por
 * conteúdo misto — passando por aqui elas aparecem normalmente.
 */

const USER_AGENT = "Vela.tv PosterProxy/1.0";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "0.0.0.0" || host === "::1") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host) || /^0\./.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

export const Route = createFileRoute("/api/public/poster")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("url");
        if (!raw) return new Response("missing url", { status: 400 });

        let target: URL;
        try {
          target = new URL(raw);
        } catch {
          return new Response("bad url", { status: 400 });
        }
        if (!["http:", "https:"].includes(target.protocol) || isPrivateHostname(target.hostname)) {
          return new Response("forbidden", { status: 403 });
        }

        try {
          const upstream = await fetch(target.toString(), {
            redirect: "follow",
            signal: AbortSignal.timeout(15_000),
            headers: { accept: "image/*,*/*", "user-agent": USER_AGENT },
          });
          if (!upstream.ok || !upstream.body) {
            return new Response("upstream error", { status: 502 });
          }
          const length = Number(upstream.headers.get("content-length") ?? 0);
          if (length > MAX_IMAGE_BYTES) return new Response("too large", { status: 413 });

          return new Response(upstream.body, {
            status: 200,
            headers: {
              "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
              "cache-control": "public, max-age=86400",
            },
          });
        } catch {
          return new Response("upstream error", { status: 502 });
        }
      },
    },
  },
});
