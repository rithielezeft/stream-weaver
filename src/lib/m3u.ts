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

/**
 * Interpreta o conteúdo de uma lista M3U/M3U8 (formato #EXTINF).
 */
export function parseM3U(content: string): Channel[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const channels: Channel[] = [];
  let pending: Partial<Channel> | null = null;

  for (const line of lines) {
    if (line.startsWith("#EXTINF")) {
      const attrs = Object.fromEntries(
        [...line.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
      );
      const name = line.includes(",")
        ? line.slice(line.lastIndexOf(",") + 1).trim()
        : "Sem nome";
      pending = {
        name,
        logo: attrs["tvg-logo"] || undefined,
        group: attrs["group-title"] || "Outros",
        tvgId: attrs["tvg-id"] || undefined,
      };
    } else if (!line.startsWith("#") && pending) {
      channels.push({
        id: `${channels.length}-${pending.name}`,
        name: pending.name!,
        url: line,
        group: pending.group || "Outros",
        ...(pending.logo ? { logo: pending.logo } : {}),
        ...(pending.tvgId ? { tvgId: pending.tvgId } : {}),
      });
      pending = null;
    }
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
