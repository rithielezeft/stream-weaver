import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Hero } from "@/components/Hero";
import { ImportPanel } from "@/components/ImportPanel";
import { ChannelRow } from "@/components/ChannelRow";
import { PlayerOverlay } from "@/components/PlayerOverlay";
import { groupByCategory, type Channel } from "@/lib/m3u";
import { sortGroups } from "@/lib/categories";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vela.tv — Reprodutor de listas M3U estilo Netflix" },
      {
        name: "description",
        content:
          "Carregue sua lista M3U e assista aos seus canais em um catálogo estilo streaming, com player HLS integrado.",
      },
      { property: "og:title", content: "Vela.tv — Reprodutor de listas M3U" },
      {
        property: "og:description",
        content:
          "Carregue sua lista M3U e assista aos seus canais em um catálogo estilo streaming, com player HLS integrado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [search, setSearch] = useState("");
  const [current, setCurrent] = useState<Channel | null>(null);
  const [myList, setMyList] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(
      (c) => c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    );
  }, [channels, search]);

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);
  const featured = filtered[0] ?? channels[0] ?? null;

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-slate-100 antialiased selection:bg-aurora-2/40">
      {/* Aurora de fundo */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/3 h-[42rem] w-[42rem] rounded-full bg-aurora-1/25 blur-[130px] animate-drift" />
        <div className="absolute right-[-10%] top-[10%] h-[38rem] w-[38rem] rounded-full bg-aurora-2/25 blur-[130px] animate-drift-reverse" />
        <div className="absolute bottom-[-15%] left-[25%] h-[34rem] w-[34rem] rounded-full bg-aurora-3/20 blur-[130px] animate-drift [animation-duration:24s]" />
      </div>

      <AppHeader
        categories={groups.map(([name]) => name)}
        search={search}
        onSearch={setSearch}
        onOpenImport={() => document.getElementById("import-panel")?.scrollIntoView({ behavior: "smooth" })}
      />

      <main className="relative z-10 mx-auto max-w-[1600px] px-6 pb-24">
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
              <p className="font-mono text-xs uppercase text-aurora-2">Catálogo vazio</p>
              <h1 className="mt-3 max-w-xl text-4xl font-black leading-tight text-foreground lg:text-6xl">Carregue sua lista M3U</h1>
              <p className="mt-3 max-w-lg text-sm text-slate-300">Os canais reais da sua lista aparecerão aqui, organizados por categoria.</p>
            </div>
          )}
          <div id="import-panel">
            <ImportPanel
              onImport={setChannels}
              totalChannels={channels.length}
              totalCategories={groups.length}
            />
          </div>
        </section>

        <section className="mt-12 space-y-10 animate-rise [animation-delay:200ms]">
          {channels.length > 0 && groups.length === 0 && (
            <p className="py-16 text-center text-sm text-slate-400">
              Nenhum canal encontrado para “{search}”.
            </p>
          )}
          {groups.map(([name, items]) => (
            <ChannelRow key={name} title={name} channels={items} onPlay={setCurrent} />
          ))}
        </section>
      </main>

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
