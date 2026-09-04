import { useRef, useState } from "react";
import { Upload, Link2, ClipboardType, FileUp } from "lucide-react";
import { parseM3U, type Channel } from "@/lib/m3u";

type Mode = "url" | "text" | "file";

interface ImportPanelProps {
  onImport: (channels: Channel[]) => void;
  totalChannels: number;
  totalCategories: number;
}

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-logo="https://exemplo.com/logo.png" group-title="Filmes",Canal 042
https://cdn.exemplo.com/canal042/index.m3u8`;

export function ImportPanel({ onImport, totalChannels, totalCategories }: ImportPanelProps) {
  const [mode, setMode] = useState<Mode>("url");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const finish = (channels: Channel[]) => {
    if (channels.length === 0) {
      setError("Nenhum canal encontrado. Verifique o formato da lista (#EXTINF + URL).");
      return;
    }
    onImport(channels);
    setValue("");
    setError(null);
  };

  const handleImport = async () => {
    setError(null);
    if (mode === "url") {
      const url = value.trim();
      if (!url) {
        setError("Cole a URL da lista M3U/M3U8.");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        finish(parseM3U(await res.text()));
      } catch {
        setError("Não foi possível baixar a lista. O servidor pode bloquear acesso externo (CORS) — tente colar o texto ou enviar o arquivo.");
      } finally {
        setLoading(false);
      }
    } else {
      finish(parseM3U(value));
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    finish(parseM3U(await file.text()));
  };

  const tabCls = (m: Mode) =>
    `flex-1 rounded-lg py-2 transition-colors ${
      mode === m ? "bg-white/10 text-slate-100" : "text-slate-400 hover:text-slate-200"
    }`;

  return (
    <aside className="flex flex-col rounded-3xl border border-white/10 bg-panel/60 p-6 backdrop-blur-xl animate-rise [animation-delay:100ms]">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-300">
          Playlist M3U
        </h2>
        <span className="font-mono text-[11px] text-aurora-3">hls.js</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        Cole a URL, o conteúdo da lista ou selecione um arquivo .m3u para carregar seus canais.
      </p>

      <div className="mt-4 flex gap-1 rounded-xl bg-ink/60 p-1 text-xs font-medium">
        <button className={tabCls("url")} onClick={() => setMode("url")}>
          <span className="inline-flex items-center gap-1"><Link2 className="size-3" /> URL</span>
        </button>
        <button className={tabCls("text")} onClick={() => setMode("text")}>
          <span className="inline-flex items-center gap-1"><ClipboardType className="size-3" /> Texto</span>
        </button>
        <button className={tabCls("file")} onClick={() => setMode("file")}>
          <span className="inline-flex items-center gap-1"><FileUp className="size-3" /> Arquivo</span>
        </button>
      </div>

      {mode === "file" ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 bg-ink/60 p-6 text-center transition-colors hover:border-aurora-2/50"
        >
          <Upload className="size-5 text-aurora-2" />
          <span className="text-xs text-slate-300">Selecionar arquivo .m3u / .m3u8</span>
          <span className="font-mono text-[10px] text-slate-500">arraste ou clique</span>
        </button>
      ) : (
        <textarea
          rows={mode === "url" ? 3 : 6}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={mode === "url" ? "https://seusite.com/playlist.m3u" : SAMPLE}
          className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-ink/60 p-3 font-mono text-[11px] leading-relaxed text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-aurora-2"
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".m3u,.m3u8,audio/x-mpegurl,application/x-mpegURL"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <button
        onClick={handleImport}
        disabled={loading}
        className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-live/90 py-3 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {loading ? "Baixando lista…" : "Importar canais"}
      </button>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/5 pt-5 text-center">
        <div>
          <div className="text-xl font-extrabold text-foreground">{totalChannels}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Canais</div>
        </div>
        <div>
          <div className="text-xl font-extrabold text-foreground">{totalCategories}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Categorias</div>
        </div>
        <div>
          <div className="text-xl font-extrabold text-live">AO VIVO</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Sinal</div>
        </div>
      </div>
    </aside>
  );
}
