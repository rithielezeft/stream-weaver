import { useState } from "react";
import { X, Play } from "lucide-react";
import type { Series } from "@/lib/series";
import type { Channel } from "@/lib/m3u";

interface Props {
  series: Series;
  onPlay: (c: Channel) => void;
  onClose: () => void;
}

/** Tela da série: escolha da temporada e lista de episódios. */
export function SeriesOverlay({ series, onPlay, onClose }: Props) {
  const [season, setSeason] = useState(series.seasons[0]?.number ?? 1);
  const current = series.seasons.find((s) => s.number === season) ?? series.seasons[0];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/90 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-panel/95">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
          <div className="flex gap-4">
            {series.logo && (
              <img
                src={series.logo}
                alt={`Capa de ${series.title}`}
                className="hidden h-28 w-20 rounded-xl object-cover sm:block"
              />
            )}
            <div>
              <p className="font-mono text-xs uppercase text-aurora-2">{series.group}</p>
              <h2 className="text-2xl font-black text-foreground">{series.title}</h2>
              <p className="mt-1 font-mono text-xs text-slate-400">
                {series.seasons.length} {series.seasons.length === 1 ? "temporada" : "temporadas"} ·{" "}
                {series.total} episódios
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-slate-200 transition-colors hover:bg-white/20"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-6 py-3 scrollbar-none">
          {series.seasons.map((s) => (
            <button
              key={s.number}
              onClick={() => setSeason(s.number)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                s.number === season
                  ? "bg-aurora-2 text-ink"
                  : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              Temporada {s.number}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {current?.episodes.map((ep) => (
              <li key={ep.channel.id}>
                <button
                  onClick={() => onPlay(ep.channel)}
                  className="flex w-full items-center gap-4 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-left transition-colors hover:border-aurora-2/40 hover:bg-white/[0.07]"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-aurora-2/20 font-mono text-sm font-bold text-aurora-2">
                    {String(ep.episode).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {ep.title}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      T{ep.season} · EP {ep.episode}
                    </span>
                  </span>
                  <Play className="size-4 shrink-0 fill-aurora-2 text-aurora-2" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
