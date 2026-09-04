export interface Channel {
  id: string;
  name: string;
  url: string;
  logo?: string;
  group: string;
  tvgId?: string;
  /** poster local gerado (caminho de import) */
  poster?: string;
  meta?: string;
  live?: boolean;
}

/** Extrai um atributo `chave="valor"` sem regex global (evita arrays enormes). */
function getAttr(line: string, key: string): string | undefined {
  const token = `${key}="`;
  const start = line.indexOf(token);
  if (start === -1) return undefined;
  const valueStart = start + token.length;
  const end = line.indexOf('"', valueStart);
  if (end === -1) return undefined;
  const value = line.slice(valueStart, end);
  return value || undefined;
}

/**
 * Interpreta o conteúdo de uma lista M3U/M3U8 (formato #EXTINF).
 * Varredura em fluxo com indexOf: não cria um array com todas as linhas,
 * o que reduz bastante o uso de memória em listas grandes.
 */
export function parseM3U(content: string): Channel[] {
  const channels: Channel[] = [];
  let pendingName: string | null = null;
  let pendingLogo: string | undefined;
  let pendingGroupTitle: string | null = null;
  let pendingTvgId: string | undefined;
  let pendingGroup: string | null = null;

  let start = content.charCodeAt(0) === 0xfeff ? 1 : 0;
  const len = content.length;

  while (start < len) {
    let end = content.indexOf("\n", start);
    if (end === -1) end = len;
    let lineEnd = end;
    if (lineEnd > start && content.charCodeAt(lineEnd - 1) === 13) lineEnd--;

    // trim sem criar cópias desnecessárias
    let s = start;
    while (s < lineEnd && (content.charCodeAt(s) === 32 || content.charCodeAt(s) === 9)) s++;
    let e = lineEnd;
    while (e > s && (content.charCodeAt(e - 1) === 32 || content.charCodeAt(e - 1) === 9)) e--;

    start = end + 1;
    if (e <= s) continue;

    const first = content[s];
    if (first === "#") {
      if (content.startsWith("#EXTINF", s)) {
        const line = content.slice(s, e);
        const comma = line.lastIndexOf(",");
        pendingName = comma !== -1 ? line.slice(comma + 1).trim() : "Sem nome";
        pendingLogo = getAttr(line, "tvg-logo");
        pendingGroupTitle = getAttr(line, "group-title") ?? null;
        pendingTvgId = getAttr(line, "tvg-id");
      } else if (content.startsWith("#EXTGRP:", s)) {
        pendingGroup = content.slice(s + 8, e).trim() || null;
      }
      continue;
    }

    // Linha de URL
    const url = content.slice(s, e);
    if (!/^(https?|rtmp|rtsp):\/\//i.test(url)) {
      pendingName = null;
      continue;
    }
    const id = String(channels.length);
    if (pendingName !== null) {
      channels.push({
        id,
        name: pendingName || `Canal ${channels.length + 1}`,
        url,
        group: pendingGroupTitle || pendingGroup || "Outros",
        ...(pendingLogo ? { logo: pendingLogo } : {}),
        ...(pendingTvgId ? { tvgId: pendingTvgId } : {}),
      });
      pendingName = null;
      pendingLogo = undefined;
      pendingGroupTitle = null;
      pendingTvgId = undefined;
    } else {
      channels.push({
        id,
        name: `Canal ${channels.length + 1}`,
        url,
        group: pendingGroup || "Outros",
      });
    }
    pendingGroup = null;
  }
  return channels;
}

export function groupByCategory(channels: Channel[]): [string, Channel[]][] {
  const map = new Map<string, Channel[]>();
  for (const ch of channels) {
    const key = ch.group || "Outros";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ch);
  }
  return [...map.entries()];
}
