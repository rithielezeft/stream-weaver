/// <reference lib="webworker" />

import { parseM3U } from "./m3u";

type ParseRequest = { content: string } | { file: File };

self.onmessage = async (event: MessageEvent<ParseRequest>) => {
  try {
    const content = "file" in event.data ? await event.data.file.text() : event.data.content;
    const channels = parseM3U(content);
    self.postMessage({ ok: true, channels });
  } catch {
    self.postMessage({ ok: false, message: "Não foi possível processar esta lista." });
  }
};
