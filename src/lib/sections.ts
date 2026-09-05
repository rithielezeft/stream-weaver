import type { CatalogItem } from "./series";
import { normalizeCategory } from "./categories";

/** Tópicos fixos do menu principal (estilo Netflix). */
export type SectionId = "inicio" | "series" | "filmes" | "lancamentos" | "cinema" | "aovivo";

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "inicio", label: "Início" },
  { id: "series", label: "Séries" },
  { id: "filmes", label: "Filmes" },
  { id: "lancamentos", label: "Lançamentos" },
  { id: "cinema", label: "Cinema" },
  { id: "aovivo", label: "Ao vivo" },
];

const MOVIE_URL = /\/(movie|filmes?)\//i;
const SERIES_URL = /\/series?\//i;

function isMovieLike(group: string, url: string): boolean {
  const g = normalizeCategory(group);
  return (
    MOVIE_URL.test(url) ||
    /\.(mp4|mkv|avi)(\?|$)/i.test(url) ||
    g.includes("FILME") ||
    g.includes("CINEMA") ||
    g.includes("LANCAMENTO")
  );
}

/** Decide se um item do catálogo pertence ao tópico escolhido no menu. */
export function matchesSection(section: SectionId, item: CatalogItem): boolean {
  if (section === "inicio") return true;
  const group = item.group ?? "";
  const g = normalizeCategory(group);
  if (section === "series") return item.kind === "series" || g.includes("SERIE");
  if (item.kind === "series") return false;

  const url = item.channel.url;
  if (section === "lancamentos") return g.includes("LANCAMENTO");
  if (section === "cinema") return g.includes("CINEMA");
  if (section === "filmes") return isMovieLike(group, url);
  // ao vivo: tudo que não parece filme nem episódio de série
  return !isMovieLike(group, url) && !SERIES_URL.test(url) && !g.includes("SERIE");
}
