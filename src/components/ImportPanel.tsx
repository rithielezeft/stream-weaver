import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Upload, Link2, ClipboardType, FileUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseM3U, type Channel } from "@/lib/m3u";
import { downloadM3U } from "@/lib/m3u-import.functions";

type Mode = "url" | "text" | "file";

interface ImportPanelProps {
  onImport: (channels: Channel[]) => void;
  totalChannels: number;
  totalCategories: number;
}

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-logo="https://exemplo.com/logo.png" group-title="Filmes",Canal 042
https://cdn.exemplo.com/canal042/index.m3u8`;
const MAX_FILE_BYTES = 150 * 1024 * 1024;

export function ImportPanel({ onImport, totalChannels, totalCategories }: ImportPanelProps) {
  const [mode, setMode] = useState<Mode>("url");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fetchPlaylist = useServerFn(downloadM3U);

  const finish = (channels: Channel[], source: string) => {
    if (channels.length === 0) {
      setError("Nenhum canal encontrado. Verifique o formato da lista (#EXTINF + URL).");
      return;
    }
    onImport(channels);
    setValue("");
    setError(null);
    setSuccess(`${channels.length.toLocaleString("pt-BR")} canais carregados de ${source}.`);
  };

  const handleImport = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (mode === "url") {
      const url = value.trim();
      if (!url) {
        setError("Cole a URL da lista M3U/M3U8.");
        return;
      }
        const result = await fetchPlaylist({ data: { url } });
        finish(parseM3U(result.text), new URL(result.sourceUrl).hostname);
      } else if (mode === "file") {
        if (!selectedFile) {
          setError("Selecione um arquivo .m3u ou .m3u8 antes de importar.");
          return;
        }
        if (selectedFile.size > MAX_FILE_BYTES) {
          setError("O arquivo excede o limite de 150 MB.");
          return;
        }
        const content = await selectedFile.text();
        finish(parseM3U(content), selectedFile.name);
      } else {
        if (!value.trim()) {
          setError("Cole o conteúdo da lista antes de importar.");
          return;
        }
        finish(parseM3U(value), "texto colado");
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(
        message.includes("150 MB") || message.includes("rede local") || message.includes("erro ")
          ? message
          : "Não foi possível acessar essa URL. Confirme o endereço e se o servidor da lista está online.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSuccess(null);
    if (file.size > MAX_FILE_BYTES) {
      setSelectedFile(null);
      setError("O arquivo excede o limite de 150 MB.");
      return;
    }
    if (!/\.(m3u8?|txt)$/i.test(file.name)) {
      setSelectedFile(null);
      setError("Selecione um arquivo .m3u, .m3u8 ou .txt.");
      return;
    }
    setSelectedFile(file);
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
        <Button type="button" variant="ghost" className={tabCls("url")} onClick={() => setMode("url")}>
          <span className="inline-flex items-center gap-1"><Link2 className="size-3" /> URL</span>
        </Button>
        <Button type="button" variant="ghost" className={tabCls("text")} onClick={() => setMode("text")}>
          <span className="inline-flex items-center gap-1"><ClipboardType className="size-3" /> Texto</span>
        </Button>
        <Button type="button" variant="ghost" className={tabCls("file")} onClick={() => setMode("file")}>
          <span className="inline-flex items-center gap-1"><FileUp className="size-3" /> Arquivo</span>
        </Button>
      </div>

      {mode === "file" ? (
        <Button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleFile(event.dataTransfer.files[0]);
          }}
          variant="ghost"
          className="mt-3 h-auto w-full flex-col gap-2 whitespace-normal rounded-xl border border-dashed border-white/15 bg-ink/60 p-6 text-center transition-colors hover:border-aurora-2/50"
        >
          {selectedFile ? <CheckCircle2 className="size-5 text-live" /> : <Upload className="size-5 text-aurora-2" />}
          <span className="max-w-full truncate text-xs text-slate-300">
            {selectedFile?.name ?? "Selecionar arquivo .m3u / .m3u8"}
          </span>
          <span className="font-mono text-[10px] text-slate-500">
            {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB · pronto para importar` : "arraste ou clique · máximo 150 MB"}
          </span>
        </Button>
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
        accept=".m3u,.m3u8,.txt,audio/x-mpegurl,application/x-mpegURL,text/plain"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {error && <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs text-destructive"><X className="mt-0.5 size-3 shrink-0" />{error}</p>}
      {success && <p role="status" className="mt-2 flex items-start gap-1.5 text-xs text-live"><CheckCircle2 className="mt-0.5 size-3 shrink-0" />{success}</p>}

      <Button
        type="button"
        onClick={handleImport}
        disabled={loading}
        className="mt-3 h-auto rounded-xl bg-live/90 py-3 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5 hover:bg-live disabled:opacity-60"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? (mode === "url" ? "Baixando e lendo…" : "Lendo arquivo…") : "Importar canais"}
      </Button>

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
