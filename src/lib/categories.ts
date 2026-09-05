// Ordenação de categorias do catálogo.

/** Categorias que devem aparecer primeiro, nesta ordem. */
export const PRIORITY_CATEGORIES = [
  "LANCAMENTOS LEGENDADOS",
  "CINEMA",
  "TERROR",
  "DRAMA",
  "UHD 4K",
  "BRASILEIRAO",
  "SPORTS WORLD",
  "NOTICIAS",
];

/** Remove acentos, pontuação e espaços extras para comparar nomes de categoria. */
export function normalizeCategory(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

/** Posição de prioridade (menor = mais acima). Desconhecidas vão para o fim. */
export function priorityIndex(name: string): number {
  const n = normalizeCategory(name);
  const exact = PRIORITY_CATEGORIES.indexOf(n);
  if (exact !== -1) return exact;
  const partial = PRIORITY_CATEGORIES.findIndex(
    (p) => n.includes(p) || p.includes(n),
  );
  return partial === -1 ? Number.MAX_SAFE_INTEGER : partial;
}

/** Ordena as categorias: prioritárias primeiro, depois as maiores. */
export function sortGroups<T>(groups: [string, T[]][]): [string, T[]][] {
  return [...groups].sort((a, b) => {
    const pa = priorityIndex(a[0]);
    const pb = priorityIndex(b[0]);
    if (pa !== pb) return pa - pb;
    if (pa === Number.MAX_SAFE_INTEGER) return b[1].length - a[1].length;
    return a[0].localeCompare(b[0], "pt-BR");
  });
}
