import { parseM3U, type Channel } from "./m3u";

type ParseInput = { content: string } | { file: File };

/** Processa listas pesadas fora da tela principal para não congelar o catálogo. */
export function parseM3UInBackground(input: ParseInput): Promise<Channel[]> {
  if (typeof Worker === "undefined") {
    if ("content" in input) return Promise.resolve(parseM3U(input.content));
    return input.file.text().then(parseM3U);
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./m3u.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ ok: boolean; channels?: Channel[]; message?: string }>) => {
      worker.terminate();
      if (event.data.ok && event.data.channels) resolve(event.data.channels);
      else reject(new Error(event.data.message ?? "Não foi possível processar esta lista."));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("Não foi possível processar esta lista."));
    };
    worker.postMessage(input);
  });
}