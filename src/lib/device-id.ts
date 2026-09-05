/**
 * Identificação do aparelho/navegador, usada para impedir que a mesma pessoa
 * crie várias contas só para repetir o teste grátis. Combina um código salvo
 * no navegador com características do aparelho.
 */
const KEY = "vela-device-id";

function hash(text: string): string {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h1 ^= text.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0");
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let stored = "";
  try {
    stored = localStorage.getItem(KEY) ?? "";
  } catch {
    /* modo privado */
  }
  const n = navigator;
  const fingerprint = hash(
    [
      n.userAgent,
      n.language,
      (n.languages ?? []).join(","),
      String(screen.width),
      String(screen.height),
      String(screen.colorDepth),
      String(new Date().getTimezoneOffset()),
      String(n.hardwareConcurrency ?? 0),
      String((n as { deviceMemory?: number }).deviceMemory ?? 0),
    ].join("|"),
  );
  if (stored && stored.endsWith(fingerprint)) return stored;
  const id = `${stored ? stored.split("-")[0] : hash(String(Math.random()) + Date.now())}-${fingerprint}`;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignora */
  }
  return id;
}
