import { Play, Plus, Check } from "lucide-react";
import type { Channel } from "@/lib/m3u";
import heroImg from "@/assets/hero.jpg";

interface HeroProps {
  channel: Channel;
  onPlay: (channel: Channel) => void;
  inList: boolean;
  onToggleList: (id: string) => void;
}

export function Hero({ channel, onPlay, inList, onToggleList }: HeroProps) {
  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-3xl border border-white/10 bg-panel/60 animate-rise lg:col-span-2">
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={heroImg}
          alt="Cena do canal em destaque"
          width={1600}
          height={900}
          className="h-full w-full object-cover animate-pan"
        />
      </div>
      <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-ink/90 via-ink/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink/80 to-transparent" />
      <div className="absolute inset-y-0 left-0 flex w-full flex-col justify-end gap-4 p-6 sm:w-4/5 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-aurora-2/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-aurora-2 ring-1 ring-aurora-2/40">
            Em destaque
          </span>
          <span className="rounded-full bg-aurora-1/15 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.15em] text-aurora-1 ring-1 ring-aurora-1/30">
            {channel.group}
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            {channel.tvgId ? `CANAL ${channel.tvgId}` : "HLS"}
          </span>
        </div>
        <h1 className="text-4xl font-black leading-[0.95] tracking-tight text-balance lg:text-6xl">
          {channel.name}
        </h1>
        <p className="max-w-[46ch] text-pretty text-sm text-slate-300">
          {channel.meta ?? "Transmissão ao vivo da sua lista M3U, reproduzida diretamente no navegador."}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={() => onPlay(channel)}
            className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5"
          >
            <span className="grid size-5 place-items-center rounded-full bg-ink">
              <Play className="size-2.5 fill-white text-white" />
            </span>
            Assistir agora
          </button>
          <button
            onClick={() => onToggleList(channel.id)}
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 backdrop-blur-md transition-colors hover:bg-white/10"
          >
            {inList ? <Check className="size-4" /> : <Plus className="size-4" />}
            Minha lista
          </button>
          <span className="font-mono text-xs text-slate-400">HLS · m3u8</span>
        </div>
      </div>
    </div>
  );
}
