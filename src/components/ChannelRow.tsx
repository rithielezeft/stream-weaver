import { useState } from "react";
import { Play } from "lucide-react";
import type { Channel } from "@/lib/m3u";

/** Quantas capas renderizar por vez — evita milhares de elementos na memória. */
const PAGE_SIZE = 24;

const GLOW: Record<string, string> = {
  Filmes: "hover:ring-aurora-2/60 hover:glow-aurora-2",
  Esportes: "hover:ring-live/60 hover:glow-live",
  Notícias: "hover:ring-aurora-3/60 hover:glow-aurora-3",
  Infantil: "hover:ring-aurora-1/60 hover:glow-aurora-1",
};

function Card({ channel, onPlay }: { channel: Channel; onPlay: (c: Channel) => void }) {
  const glow = GLOW[channel.group] ?? "hover:ring-aurora-2/60 hover:glow-aurora-2";
  return (
    <button
      onClick={() => onPlay(channel)}
      className={`group relative w-[180px] shrink-0 overflow-hidden rounded-2xl text-left ring-1 ring-white/10 transition-all duration-300 ${glow}`}
    >
      <div className="aspect-[2/3] w-full overflow-hidden bg-surface">
        {channel.poster || channel.logo ? (
          <img
            src={channel.poster ?? channel.logo}
            alt={`Capa de ${channel.name}`}
            loading="lazy"
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
}

interface ChannelRowProps {
  title: string;
  channels: Channel[];
  onPlay: (c: Channel) => void;
}

export function ChannelRow({ title, channels, onPlay }: ChannelRowProps) {
  if (channels.length === 0) return null;
  return (
    <div id={`cat-${title}`}>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        <span className="font-mono text-xs text-slate-400">
          {channels.length} {channels.length === 1 ? "canal" : "canais"}
        </span>
      </div>
      <div className="-mx-2 flex gap-4 overflow-x-auto px-2 pb-2 scrollbar-none">
        {channels.map((ch) => (
          <Card key={ch.id} channel={ch} onPlay={onPlay} />
        ))}
      </div>
    </div>
  );
}
