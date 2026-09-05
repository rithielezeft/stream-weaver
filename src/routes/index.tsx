import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader } from "@/components/AppHeader";
import { Hero } from "@/components/Hero";
import { ImportPanel } from "@/components/ImportPanel";
import { ChannelRow } from "@/components/ChannelRow";
import { PlayerOverlay } from "@/components/PlayerOverlay";
import { SeriesOverlay } from "@/components/SeriesOverlay";
import type { Channel } from "@/lib/m3u";
import { buildCatalog, groupCatalog, type CatalogItem, type Series } from "@/lib/series";
import { sortGroups } from "@/lib/categories";
import { matchesSection, type SectionId } from "@/lib/sections";
import { clearPlaylist, loadPlaylist, savePlaylist } from "@/lib/playlist-store";
import { claimPlaylist, getMyAccount, type AccountView } from "@/lib/account.functions";
import { getSiteInfo, type ShowcasePoster } from "@/lib/showcase.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vela.tv — Reprodutor de listas M3U estilo Netflix" },
      {
        name: "description",
        content:
          "Crie sua conta, carregue sua lista M3U e assista aos seus canais em um catálogo estilo streaming, com player integrado.",
      },
      { property: "og:title", content: "Vela.tv — Reprodutor de listas M3U" },
      {
        property: "og:description",
        content:
          "Crie sua conta, carregue sua lista M3U e assista aos seus canais em um catálogo estilo streaming.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

/** Impressão digital simples da lista, para saber se outra conta já a usa. */
function playlistFingerprint(list: Channel[], source: string): string {
  const base = `${source}|${list.length}|${list[0]?.url ?? ""}|${list[list.length - 1]?.url ?? ""}`;
  let h1 = 0x811c9dc5;
  for (let i = 0; i < base.length; i += 1) {
    h1 ^= base.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return `fp_${(h1 >>> 0).toString(16)}_${base.length}_${list.length}`;
}

function Index() {
  const me = useServerFn(getMyAccount);
  const claim = useServerFn(claimPlaylist);
  const siteInfo = useServerFn(getSiteInfo);

  const [account, setAccount] = useState<AccountView | null>(null);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");
  const [posters, setPosters] = useState<ShowcasePoster[]>([]);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<SectionId>("inicio");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [current, setCurrent] = useState<Channel | null>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [myList, setMyList] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<{ source: string; savedAt: number } | null>(null);
  const [restoring, setRestoring] = useState(true);

  // Conta do cliente e dados públicos (WhatsApp + capas da vitrine).
  useEffect(() => {
    let active = true;
    void Promise.all([me(), siteInfo()])
      .then(([acc, info]) => {
        if (!active) return;
        setAccount(acc);
        setWhatsapp(info.whatsapp);
        setPosters(info.posters);
      })
      .catch(() => undefined)
      .finally(() => active && setCheckingAccount(false));
    return () => {
      active = false;
    };
  }, [me, siteInfo]);

  const signedIn = Boolean(account);

  // Recupera a lista guardada no dispositivo — só para quem tem conta.
  useEffect(() => {
    if (!signedIn) {
      setRestoring(false);
      return;
    }
    let active = true;
    void loadPlaylist().then((data) => {
      if (!active) return;
      if (data) {
        setChannels(data.channels);
        setSaved({ source: data.source, savedAt: data.savedAt });
      }
      setRestoring(false);
    });
    return () => {
      active = false;
    };
  }, [signedIn]);

  const [claimError, setClaimError] = useState("");

  const handleImport = async (list: Channel[], source: string) => {
    setClaimError("");
    const res = await claim({
      data: { fingerprint: playlistFingerprint(list, source), source, channels: list.length },
    });
    if (!res.ok) {
      setClaimError(res.message);
      return;
    }
    setChannels(list);
    setSaved({ source, savedAt: Date.now() });
    void savePlaylist(list, source);
  };

  const handleClearSaved = () => {
    setChannels([]);
    setSaved(null);
    void clearPlaylist();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(
      (c) => c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    );
  }, [channels, search]);

  const catalog = useMemo(() => buildCatalog(filtered), [filtered]);
  const allGroups = useMemo(() => sortGroups(groupCatalog(catalog)), [catalog]);

  const groups = useMemo(() => {
    if (activeCategory) return allGroups.filter(([name]) => name === activeCategory);
    if (section === "inicio") return allGroups;
    return allGroups
      .map(([name, items]) => [name, items.filter((i) => matchesSection(section, i))] as [
        string,
        CatalogItem[],
      ])
      .filter(([, items]) => items.length > 0);
  }, [allGroups, section, activeCategory]);

  const featured = filtered[0] ?? channels[0] ?? null;

  const openItem = (item: CatalogItem) => {
    if (item.kind === "series") setSeries(item.series);
    else setCurrent(item.channel);
  };

  // Mostra as primeiras categorias na hora e revela o resto em segundo plano.
  const [rowsVisible, setRowsVisible] = useState(4);
  useEffect(() => setRowsVisible(4), [filtered, section, activeCategory]);
  useEffect(() => {
    if (rowsVisible >= groups.length) return;
    const id = setTimeout(() => setRowsVisible((v) => v + 4), 300);
    return () => clearTimeout(id);
  }, [rowsVisible, groups.length]);

  const toggleList = (id: string) =>
    setMyList((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const upNext = current
    ? channels.filter((c) => c.group === current.group && c.id !== current.id).slice(0, 8)
    : [];

  const whatsLink = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        "Olá! Quero assistir na Vela.tv",
      )}`
    : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-slate-100 antialiased selection:bg-aurora-2/40">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/3 h-[42rem] w-[42rem] rounded-full bg-aurora-1/25 blur-[130px] animate-drift" />
        <div className="absolute right-[-10%] top-[10%] h-[38rem] w-[38rem] rounded-full bg-aurora-2/25 blur-[130px] animate-drift-reverse" />
        <div className="absolute bottom-[-15%] left-[25%] h-[34rem] w-[34rem] rounded-full bg-aurora-3/20 blur-[130px] animate-drift [animation-duration:24s]" />
      </div>

      <AppHeader
        categories={allGroups.map(([name]) => name)}
        section={section}
        onSection={setSection}
        activeCategory={activeCategory}
        onCategory={setActiveCategory}
        search={search}
        onSearch={setSearch}
        signedIn={signedIn}
        onOpenImport={() =>
          document.getElementById("import-panel")?.scrollIntoView({ behavior: "smooth" })
        }
      />

      {!signedIn ? (
        <main className="relative z-10 mx-auto max-w-[1600px] px-6 pb-24">
          <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-panel/60 p-8 text-center">
            <p className="font-mono text-xs uppercase text-aurora-2">Acesso exclusivo</p>
            <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-black leading-tight text-foreground lg:text-5xl">
              Crie sua conta para assistir
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300">
              O catálogo abaixo é só uma amostra. Faça sua conta e ganhe 3 dias de teste, ou fale
              com a gente no WhatsApp.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/conta"
                className="rounded-full bg-gradient-to-r from-aurora-1 via-aurora-2 to-aurora-3 px-6 py-3 text-sm font-bold text-ink"
              >
                Criar conta · 3 dias grátis
              </Link>
              {whatsLink && (
                <a
                  href={whatsLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-slate-100 hover:bg-white/5"
                >
                  Falar no WhatsApp
                </a>
              )}
            </div>
            {checkingAccount && (
              <p className="mt-4 font-mono text-xs text-slate-500">Verificando sua conta…</p>
            )}
          </section>

          {posters.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-bold text-foreground">Um gostinho do catálogo</h2>
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
                {posters.map((poster, index) => (
                  <div
                    key={`${poster.logo}-${index}`}
                    className="group relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-ink/60"
                    title={poster.name}
                  >
                    <img
                      src={poster.logo}
                      alt={poster.name}
                      loading="lazy"
                      className="size-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink to-transparent p-2">
                      <p className="truncate text-[11px] font-semibold text-slate-200">
                        {poster.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      ) : (
        <main className="relative z-10 mx-auto max-w-[1600px] px-6 pb-24">
          {account && (
            <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-panel/60 p-5">
              <div>
                <p className="font-mono text-[11px] uppercase text-aurora-2">Situação da conta</p>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {account.unlimited
                    ? "Administrador — acesso ilimitado"
                    : account.status === "trial"
                    ? `Teste grátis — ${Math.max(0, account.daysLeft)} dia(s) restantes`
                    : account.status === "active"
                      ? `${account.planName ?? "Plano ativo"} — ${Math.max(0, account.daysLeft)} dia(s)`
                      : account.status === "blocked"
                        ? "Conta bloqueada"
                        : "Acesso vencido"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {account.unlimited
                    ? "Sua conta não possui prazo de vencimento."
                    : account.status === "trial"
                    ? "Conecte aqui a sua lista e ative um plano quando quiser continuar."
                    : "Você pode trocar de plano ou renovar a qualquer momento."}
                </p>
              </div>
              <div className="flex gap-3">
                {account.role === "admin" ? (
                  <Link
                    to="/admin"
                    className="rounded-full bg-gradient-to-r from-aurora-1 via-aurora-2 to-aurora-3 px-5 py-2.5 text-xs font-bold text-ink"
                  >
                    Painel do administrador
                  </Link>
                ) : (
                  <Link
                    to="/conta"
                    className="rounded-full bg-gradient-to-r from-aurora-1 via-aurora-2 to-aurora-3 px-5 py-2.5 text-xs font-bold text-ink"
                  >
                    {account.status === "trial" || account.status === "expired"
                      ? "Ativar plano"
                      : "Mudar plano"}
                  </Link>
                )}
                {whatsLink && (
                  <a
                    href={whatsLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/15 px-5 py-2.5 text-xs font-semibold text-slate-100 hover:bg-white/5"
                  >
                    Falar no WhatsApp
                  </a>
                )}
              </div>
            </section>
          )}

          {claimError && (
            <p className="mt-4 rounded-2xl border border-live/40 bg-live/10 px-4 py-3 text-sm text-live">
              {claimError}
            </p>
          )}

          <section className="grid gap-6 pt-6 lg:grid-cols-3">
            {featured ? (
              <Hero
                channel={featured}
                onPlay={setCurrent}
                inList={myList.has(featured.id)}
                onToggleList={toggleList}
              />
            ) : (
              <div className="relative flex min-h-[420px] flex-col justify-end overflow-hidden rounded-3xl border border-white/10 bg-panel/60 p-8 lg:col-span-2">
                <p className="font-mono text-xs uppercase text-aurora-2">
                  {restoring ? "Abrindo lista salva" : "Catálogo vazio"}
                </p>
                <h1 className="mt-3 max-w-xl text-4xl font-black leading-tight text-foreground lg:text-6xl">
                  {restoring ? "Recuperando sua lista…" : "Carregue sua lista M3U"}
                </h1>
                <p className="mt-3 max-w-lg text-sm text-slate-300">
                  Os canais reais da sua lista aparecerão aqui, organizados por categoria.
                </p>
              </div>
            )}
            <div id="import-panel">
              <ImportPanel
                onImport={handleImport}
                totalChannels={channels.length}
                totalCategories={allGroups.length}
                saved={saved}
                onClearSaved={handleClearSaved}
              />
            </div>
          </section>

          <section className="mt-12 space-y-10 animate-rise [animation-delay:200ms]">
            {channels.length > 0 && groups.length === 0 && (
              <p className="py-16 text-center text-sm text-slate-400">
                Nada encontrado aqui{search ? ` para “${search}”` : ""}.
              </p>
            )}
            {groups.slice(0, rowsVisible).map(([name, items]) => (
              <ChannelRow key={name} title={name} items={items} onOpen={openItem} />
            ))}
            {rowsVisible < groups.length && (
              <p className="py-6 text-center font-mono text-xs text-slate-500">
                Carregando mais categorias… ({rowsVisible}/{groups.length})
              </p>
            )}
          </section>
        </main>
      )}

      {series && !current && (
        <SeriesOverlay series={series} onPlay={setCurrent} onClose={() => setSeries(null)} />
      )}

      {current && (
        <PlayerOverlay
          channel={current}
          upNext={upNext}
          onPlay={setCurrent}
          onClose={() => setCurrent(null)}
        />
      )}
    </div>
  );
}
