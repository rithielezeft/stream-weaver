import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Capa guardada no banco — só imagem, nome e categoria (sem link do stream). */
export interface ShowcasePoster {
  name: string;
  group: string;
  logo: string;
}

export interface SiteInfo {
  whatsapp: string;
  posters: ShowcasePoster[];
}

const MAX_POSTERS = 240;
const MAX_SHOWCASE_BYTES = 80 * 1024 * 1024;

/** Dados públicos da página inicial: WhatsApp de contato e capas da vitrine. */
export const getSiteInfo = createServerFn({ method: "GET" }).handler(async (): Promise<SiteInfo> => {
  try {
    const { collections } = await import("./db.server");
    const { settings } = await collections();
    const [whats, posters] = await Promise.all([
      settings.findOne({ key: "support_whatsapp" }),
      settings.findOne({ key: "showcase_posters" }),
    ]);
    return {
      whatsapp: String(whats?.value ?? ""),
      posters: Array.isArray(posters?.value) ? (posters.value as ShowcasePoster[]) : [],
    };
  } catch {
    return { whatsapp: "", posters: [] };
  }
});

/** Salva o WhatsApp que aparece para quem ainda não tem conta. */
export const adminSaveSupport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ whatsapp: z.string().trim().max(40) }).parse(data))
  .handler(async ({ data }) => {
    const { collections, ensureIndexes } = await import("./db.server");
    const { requireAdmin } = await import("./auth.server");
    await requireAdmin();
    await ensureIndexes();
    const { settings } = await collections();
    await settings.updateOne(
      { key: "support_whatsapp" },
      { $set: { value: data.whatsapp } },
      { upsert: true },
    );
    return { ok: true };
  });

/**
 * O administrador informa uma lista M3U só para a vitrine: guardamos apenas as
 * capas no banco. Depois de importar, a lista pode ser removida — as capas
 * continuam salvas.
 */
export const adminImportShowcase = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ url: z.string().url().max(4096) }).parse(data))
  .handler(async ({ data }) => {
    const { collections, ensureIndexes } = await import("./db.server");
    const { requireAdmin } = await import("./auth.server");
    const { parseM3U } = await import("./m3u");
    await requireAdmin();
    await ensureIndexes();

    const target = new URL(data.url);
    if (!["http:", "https:"].includes(target.protocol))
      throw new Error("Use um endereço http ou https.");

    const response = await fetch(target.toString(), {
      headers: { accept: "*/*", "user-agent": "VLC/3.0.20 LibVLC/3.0.20" },
      redirect: "follow",
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`O servidor respondeu ${response.status}.`);

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Não foi possível ler a lista.");
    const decoder = new TextDecoder("utf-8");
    let text = "";
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      text += decoder.decode(value, { stream: true });
      if (size >= MAX_SHOWCASE_BYTES) {
        await reader.cancel();
        text = text.slice(0, text.lastIndexOf("\n"));
        break;
      }
    }

    const channels = parseM3U(text);
    const posters: ShowcasePoster[] = [];
    const seen = new Set<string>();
    for (const channel of channels) {
      if (!channel.logo || seen.has(channel.logo)) continue;
      seen.add(channel.logo);
      posters.push({ name: channel.name, group: channel.group, logo: channel.logo });
      if (posters.length >= MAX_POSTERS) break;
    }

    const { settings } = await collections();
    await settings.updateOne(
      { key: "showcase_posters" },
      { $set: { value: posters } },
      { upsert: true },
    );
    await settings.updateOne(
      { key: "showcase_source" },
      { $set: { value: { url: data.url, importedAt: new Date().toISOString(), total: posters.length } } },
      { upsert: true },
    );
    return { ok: true, total: posters.length };
  });

/** Remove as capas guardadas (use só se quiser limpar a vitrine de vez). */
export const adminClearShowcase = createServerFn({ method: "POST" }).handler(async () => {
  const { collections } = await import("./db.server");
  const { requireAdmin } = await import("./auth.server");
  await requireAdmin();
  const { settings } = await collections();
  await settings.deleteOne({ key: "showcase_posters" });
  await settings.deleteOne({ key: "showcase_source" });
  return { ok: true };
});

/** Esquece só o endereço da lista da vitrine; as capas continuam salvas. */
export const adminForgetShowcaseSource = createServerFn({ method: "POST" }).handler(async () => {
  const { collections } = await import("./db.server");
  const { requireAdmin } = await import("./auth.server");
  await requireAdmin();
  const { settings } = await collections();
  await settings.deleteOne({ key: "showcase_source" });
  return { ok: true };
});
