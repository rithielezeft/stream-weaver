import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle, UserPlus, X } from "lucide-react";
import type { ShowcasePoster } from "@/lib/showcase.functions";

/** Capas vindas de servidores HTTP passam pelo nosso endereço seguro. */
export function posterSrc(logo: string) {
  return `/api/public/poster?url=${encodeURIComponent(logo)}`;
}

function ShowcaseImage({ poster }: { poster: ShowcasePoster }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      {!loaded && !failed && (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-panel to-surface">
          <span className="flex flex-col items-center gap-2 text-[10px] text-slate-400">
            <span className="size-5 animate-spin rounded-full border-2 border-white/10 border-t-aurora-2" />
            Carregando capa
          </span>
        </div>
      )}
      {failed ? (
        <div className="grid size-full place-items-center bg-gradient-to-br from-panel to-surface text-3xl font-black text-aurora-2/60">
          {poster.name.slice(0, 1).toUpperCase()}
        </div>
      ) : (
        <img
          src={posterSrc(poster.logo)}
          alt={poster.name}
          loading="lazy"
          decoding="async"
          width={320}
          height={480}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`size-full object-cover transition-opacity group-hover:opacity-100 ${loaded ? "opacity-85" : "opacity-0"}`}
        />
      )}
    </>
  );
}

interface Props {
  posters: ShowcasePoster[];
  whatsapp: string;
}

const PAGE = 60;

export function ShowcaseGrid({ posters, whatsapp }: Props) {
  const [visible, setVisible] = useState(PAGE);
  const [selected, setSelected] = useState<ShowcasePoster | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, ShowcasePoster[]>();
    for (const p of posters) {
      const key = p.group || "Outros";
      const list = map.get(key);
      if (list) list.push(p);
      else map.set(key, [p]);
    }
    return [...map.entries()];
  }, [posters]);

  const shown = posters.slice(0, visible);

  const whatsHref = (extra: string) =>
    whatsapp
      ? `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(extra)}`
      : null;

  if (posters.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-bold text-foreground">Catálogo disponível</h2>
        <p className="font-mono text-[11px] text-slate-500">
          {posters.length.toLocaleString("pt-BR")} títulos · {groups.length} categorias
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
        {shown.map((poster, index) => (
          <button
            type="button"
            key={`${poster.logo}-${index}`}
            onClick={() => setSelected(poster)}
            className="group relative aspect-[2/3] cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-ink/60 text-left transition-transform hover:-translate-y-1 hover:border-aurora-2/50"
            title={`Ver opções para ${poster.name}`}
            aria-label={`Ver opções para ${poster.name}`}
          >
            <ShowcaseImage poster={poster} />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink to-transparent p-2">
              <p className="truncate text-[11px] font-semibold text-slate-200">{poster.name}</p>
              <p className="truncate font-mono text-[9px] uppercase text-slate-500">
                {poster.group}
              </p>
            </div>
          </button>
        ))}
      </div>

      {visible < posters.length && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            title="Carregar mais títulos"
            className="rounded-full border border-white/15 px-6 py-2.5 text-xs font-semibold text-slate-100 hover:bg-white/5"
          >
            Ver mais títulos
          </button>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-panel p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase text-aurora-2">{selected.group}</p>
                <h3 className="mt-1 text-xl font-black text-foreground">{selected.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Fechar"
                className="rounded-full p-1 text-slate-400 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-300">
              Para assistir você precisa de uma conta. Crie a sua com 3 dias grátis ou fale com a
              gente no WhatsApp para tirar dúvidas e pedir acesso.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Link
                to="/conta"
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-aurora-1 via-aurora-2 to-aurora-3 px-5 py-3 text-sm font-bold text-ink"
              >
                <UserPlus className="size-4" /> Criar conta · 3 dias grátis
              </Link>
              {whatsHref(`Olá! Quero assistir "${selected.name}" na Vela.tv. Pode me ajudar?`) && (
                <a
                  href={whatsHref(`Olá! Quero assistir "${selected.name}" na Vela.tv. Pode me ajudar?`)!}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-slate-100 hover:bg-white/5"
                >
                  <MessageCircle className="size-4" /> Solicitar acesso no WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
