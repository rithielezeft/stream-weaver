import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_PLAYLIST_BYTES = 20 * 1024 * 1024;
const PLAYLIST_TIMEOUT_MS = 20_000;

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "0.0.0.0" || host === "::1") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

export const downloadM3U = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ url: z.string().url().max(4096) }).parse(input))
  .handler(async ({ data }) => {
    const target = new URL(data.url);
    if (!["http:", "https:"].includes(target.protocol)) {
      throw new Error("A lista precisa usar um endereço HTTP ou HTTPS.");
    }
    if (isPrivateHostname(target.hostname)) {
      throw new Error("Endereços de rede local não podem ser acessados pelo site online.");
    }

    const response = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(PLAYLIST_TIMEOUT_MS),
      headers: {
        Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, audio/mpegurl, text/plain, */*",
        "User-Agent": "Vela.tv Playlist Importer/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`O servidor da lista respondeu com erro ${response.status}.`);
    }

    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > MAX_PLAYLIST_BYTES) {
      throw new Error("A lista excede o limite de 20 MB.");
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_PLAYLIST_BYTES) {
      throw new Error("A lista excede o limite de 20 MB.");
    }

    const bytes = new Uint8Array(buffer);
    let text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(bytes);

    return { text, sourceUrl: response.url || target.toString() };
  });