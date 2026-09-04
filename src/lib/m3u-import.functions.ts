import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_PLAYLIST_BYTES = 150 * 1024 * 1024;
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

    // Lê em blocos e corta no limite em vez de falhar com listas muito grandes.
    const chunks: Uint8Array[] = [];
    let total = 0;
    let truncated = false;

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        let piece = value;
        if (total + piece.byteLength > MAX_PLAYLIST_BYTES) {
          piece = piece.subarray(0, MAX_PLAYLIST_BYTES - total);
          truncated = true;
        }
        chunks.push(piece);
        total += piece.byteLength;
        if (truncated) {
          await reader.cancel().catch(() => {});
          break;
        }
      }
    } else {
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const cut = bytes.subarray(0, MAX_PLAYLIST_BYTES);
      truncated = bytes.byteLength > cut.byteLength;
      chunks.push(cut);
      total = cut.byteLength;
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    let text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (text.includes("\uFFFD")) text = new TextDecoder("windows-1252").decode(bytes);
    if (truncated) {
      // Evita cortar uma entrada no meio da linha.
      text = text.slice(0, text.lastIndexOf("\n") + 1 || text.length);
    }

    return { text, sourceUrl: response.url || target.toString(), truncated };
  });