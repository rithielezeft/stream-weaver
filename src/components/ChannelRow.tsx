import { memo, useEffect, useRef, useState } from "react";
import { Play, ChevronDown } from "lucide-react";
import type { Channel } from "@/lib/m3u";

/** Quantas capas renderizar por vez — evita milhares de elementos na memória. */
const PAGE_SIZE = 24;
/** Quantos itens carregar a cada rolagem no modo "ver todos". */
const GRID_PAGE = 60;

const GLOW: Record<string, string> = {
  Filmes: "hover:ring-aurora-2/60 hover:glow-aurora-2",
  Esportes: "hover:ring-live/60 hover:glow-live",
  Notícias: "hover:ring-aurora-3/60 hover:glow-aurora-3",
  Infantil: "hover:ring-aurora-1/60 hover:glow-aurora-1",
};

/**
 * Carrega a capa só quando o cartão se aproxima da tela (segundo plano),
 * para a lista aparecer rápido mesmo com milhares de itens.
 */
function useNearViewport<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return { ref, near };
}

const Card = memo(function Card({
  channel,
  onPlay,
  wide,
}: {
  channel: Channel;
  onPlay: (c: Channel) => void;
  wide?: boolean;
}) {
  const glow = GLOW[channel.group] ?? "hover:ring-aurora-2/60 hover:glow-aurora-2";
  const { ref, near } = useNearViewport<HTMLButtonElement>();
  const src = channel.poster ?? channel.logo;
  return (
    <button
      ref={ref}
      onClick={() => onPlay(channel)}
      className={`group relative overflow-hidden rounded-2xl text-left ring-1 ring-white/10 transition-all duration-300 ${wide ? "w-full" : "w-[180px] shrink-0"} ${glow}`}
    >
      <div className="aspect-[2/3] w-full overflow-hidden bg-surface">
        {src && near ? (
          <img
            src={src}
            alt={`Capa de ${channel.name}`}
            loading="lazy"
            decoding="async"
            width={512}
            height={768}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-panel to-surface transition-transform duration-500 group-hover:scale-105">
            <span className="text-4xl font-black text-aurora-2/60">
              {channel.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      {channel.live && (
        <span className="absolute left-3 top-3 rounded-md bg-live px-2 py-0.5 font-mono text-[10px] font-bold text-ink">
          AO VIVO
        </span>
      )}
      <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-ink/70 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
        <Play className="size-3.5 fill-white text-white" />
      </span>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink to-transparent p-3 pt-10">
        <div className="truncate text-sm font-bold text-foreground">{channel.name}</div>
        <div className="font-mono text-[10px] text-slate-400">
          {channel.meta ?? channel.group}
        </div>
      </div>
    </button>
  );
});

interface ChannelRowProps {
  title: string;
  channels: Channel[];
  onPlay: (c: Channel) => void;
}

export function ChannelRow({ title, channels, onPlay }: ChannelRowProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState(false);
  const [gridVisible, setGridVisible] = useState(GRID_PAGE);
  const sentinel = useRef<HTMLDivElement | null>(null);

  // No modo "ver todos", carrega mais itens conforme a pessoa rola.
  useEffect(() => {
    if (!expanded) return;
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setGridVisible((v) => (v >= channels.length ? v : v + GRID_PAGE));
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [expanded, channels.length, gridVisible]);

  if (channels.length === 0) return null;
  const shown = channels.slice(0, expanded ? gridVisible : visible);
  const remaining = channels.length - shown.length;

  return (
    <div id={`cat-${title}`} className="scroll-mt-24">
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-400">
            {channels.length.toLocaleString("pt-BR")} {channels.length === 1 ? "item" : "itens"}
          </span>
          <button
            onClick={() => {
              setExpanded((v) => !v);
              setGridVisible(GRID_PAGE);
            }}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-aurora-2 transition-colors hover:bg-white/10"
          >
            {expanded ? "Ver menos" : "Ver todos"}
          </button>
        </div>
      </div>

      {expanded ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {shown.map((ch) => (
              <Card key={ch.id} channel={ch} onPlay={onPlay} wide />
            ))}
          </div>
          <div ref={sentinel} className="h-8" />
          {remaining > 0 && (
            <div className="flex justify-center">
              <button
                onClick={() => setGridVisible((v) => v + GRID_PAGE)}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-panel/60 px-5 py-2 text-xs font-bold text-aurora-2 transition-colors hover:bg-panel"
              >
                <ChevronDown className="size-4" />
                Carregar mais (+{remaining.toLocaleString("pt-BR")})
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="-mx-2 flex gap-4 overflow-x-auto px-2 pb-2 scrollbar-none">
          {shown.map((ch) => (
            <Card key={ch.id} channel={ch} onPlay={onPlay} />
          ))}
          {remaining > 0 && (
            <button
              onClick={() => setVisible((v) => v + PAGE_SIZE * 5)}
              className="grid w-[120px] shrink-0 place-items-center rounded-2xl bg-panel/60 text-center ring-1 ring-white/10 transition-colors hover:bg-panel hover:ring-aurora-2/50"
            >
              <span className="px-3 text-xs font-bold text-aurora-2">
                Mostrar mais
                <span className="mt-1 block font-mono text-[10px] font-normal text-slate-400">
                  +{remaining.toLocaleString("pt-BR")} itens
                </span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
