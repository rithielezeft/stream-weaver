import { Search, Plus } from "lucide-react";

interface AppHeaderProps {
  categories: string[];
  search: string;
  onSearch: (value: string) => void;
  onOpenImport: () => void;
}

export function AppHeader({ categories, search, onSearch, onOpenImport }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-ink/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-6 py-4">
        <a href="#" className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-aurora-1 via-aurora-2 to-aurora-3 font-black text-ink">
            V
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            Vela<span className="text-aurora-2">.tv</span>
          </span>
        </a>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-300 lg:flex">
          <a href="#" className="text-foreground">Início</a>
          {categories.slice(0, 5).map((cat) => (
            <a
              key={cat}
              href={`#cat-${cat}`}
              className="transition-colors hover:text-foreground"
            >
              {cat}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
            <Search className="size-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Buscar canal ou série…"
              className="w-40 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none lg:w-52"
            />
          </div>
          <button
            onClick={onOpenImport}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-aurora-1 via-aurora-2 to-aurora-3 px-4 py-2 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
          >
            <Plus className="size-4" strokeWidth={3} />
            <span className="hidden sm:inline">Carregar lista M3U</span>
            <span className="sm:hidden">M3U</span>
          </button>
        </div>
      </div>
    </header>
  );
}
