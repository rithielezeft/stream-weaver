import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  /** Frase curta em destaque, ex.: "Verificando sua conta". */
  title: string;
  /** Explicação abaixo, para o cliente esperar com calma. */
  hint?: string;
  /** Quando true, cobre a tela inteira. */
  overlay?: boolean;
}

/** Aviso visível de carregamento, usado em todo o site. */
export function LoadingScreen({ title, hint, overlay = false }: LoadingScreenProps) {
  const content = (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-white/10 bg-panel/70 px-8 py-10 text-center backdrop-blur-xl animate-rise"
    >
      <span className="relative flex size-14 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-aurora-2/25" />
        <Loader2 className="size-9 animate-spin text-aurora-2" />
      </span>
      <p className="text-lg font-black leading-tight text-foreground">{title}…</p>
      <p className="text-xs leading-relaxed text-slate-400">
        {hint ?? "Isso pode levar alguns segundos. Não feche esta página."}
      </p>
      <span className="h-1.5 w-40 overflow-hidden rounded-full bg-ink/80">
        <span className="block h-full w-1/3 animate-drift rounded-full bg-gradient-to-r from-aurora-1 via-aurora-2 to-live" />
      </span>
    </div>
  );

  if (!overlay) return <div className="flex justify-center py-16">{content}</div>;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/85 px-6 backdrop-blur-md">
      {content}
    </div>
  );
}
