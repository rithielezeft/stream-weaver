import type { Channel } from "./m3u";

/**
 * Agrupa episódios de séries. Uma lista M3U traz cada episódio como um item
 * solto ("La Casa de Papel S01E03"); aqui juntamos tudo dentro da própria
 * série, com temporadas e episódios separados.
 */

export interface Episode {
  channel: Channel;
  season: number;
  episode: number;
  /** Nome do episódio, quando a lista informa algo além do S01E01. */
  title: string;
}

export interface Series {
  id: string;
  title: string;
  group: string;
  logo?: string;
  seasons: { number: number; episodes: Episode[] }[];
  total: number;
}

export type CatalogItem =
  | { kind: "channel"; id: string; name: string; group: string; channel: Channel }
  | { kind: "series"; id: string; name: string; group: string; series: Series };

const EPISODE_RE =
  /^(.*?)[\s._-]*(?:\(|\[)?\s*(?:s|t|temp(?:orada)?\s*)(\d{1,2})\s*[\s._-]*(?:e|ep|x|episodio|episódio)\s*(\d{1,3})\s*(?:\)|\])?[\s._-]*(.*)$/i;

/** Extrai série/temporada/episódio de um nome como "Serie S01E02 - Piloto". */
export function parseEpisodeName(
  name: string,
): { title: string; season: number; episode: number; rest: string } | null {
  const m = EPISODE_RE.exec(name.trim());
  if (!m) return null;
  const title = (m[1] ?? "").replace(/[\s._-]+$/, "").trim();
  if (!title) return null;
  const season = Number(m[2]);
  const episode = Number(m[3]);
  if (!Number.isFinite(season) || !Number.isFinite(episode)) return null;
  return { title, season, episode, rest: (m[4] ?? "").replace(/^[\s._:-]+/, "").trim() };
}

function keyOf(title: string, group: string): string {
  return `${group.toLowerCase()}::${title.toLowerCase().replace(/\s+/g, " ")}`;
}

/**
 * Constrói o catálogo: canais/filmes ficam como estão e episódios viram
 * uma única capa por série, com as temporadas ordenadas dentro dela.
 */
export function buildCatalog(channels: Channel[]): CatalogItem[] {
  const items: CatalogItem[] = [];
  const seriesIndex = new Map<string, Series>();

  for (const channel of channels) {
    const parsed = parseEpisodeName(channel.name);
    if (!parsed) {
      items.push({
        kind: "channel",
        id: channel.id,
        name: channel.name,
        group: channel.group,
        channel,
      });
      continue;
    }
    const key = keyOf(parsed.title, channel.group);
    let series = seriesIndex.get(key);
    if (!series) {
      series = {
        id: `s-${seriesIndex.size}`,
        title: parsed.title,
        group: channel.group,
        ...(channel.logo ? { logo: channel.logo } : {}),
        seasons: [],
        total: 0,
      };
      seriesIndex.set(key, series);
      items.push({
        kind: "series",
        id: series.id,
        name: series.title,
        group: series.group,
        series,
      });
    }
    if (!series.logo && channel.logo) series.logo = channel.logo;
    let season = series.seasons.find((s) => s.number === parsed.season);
    if (!season) {
      season = { number: parsed.season, episodes: [] };
      series.seasons.push(season);
    }
    season.episodes.push({
      channel,
      season: parsed.season,
      episode: parsed.episode,
      title: parsed.rest || `Episódio ${parsed.episode}`,
    });
    series.total += 1;
  }

  for (const series of seriesIndex.values()) {
    series.seasons.sort((a, b) => a.number - b.number);
    for (const s of series.seasons) s.episodes.sort((a, b) => a.episode - b.episode);
  }

  return items;
}

export function groupCatalog(items: CatalogItem[]): [string, CatalogItem[]][] {
  const map = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const key = item.group || "Outros";
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()];
}
