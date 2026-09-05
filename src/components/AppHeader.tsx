import { Search, Plus, ChevronDown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SECTIONS, type SectionId } from "@/lib/sections";

interface AppHeaderProps {
  categories: string[];
  section: SectionId;
  onSection: (section: SectionId) => void;
  activeCategory: string | null;
  onCategory: (name: string | null) => void;
  search: string;
  onSearch: (value: string) => void;
  onOpenImport: () => void;
  signedIn: boolean;
}

export function AppHeader({
  categories,
  section,
  onSection,
  activeCategory,
  onCategory,
  search,
  onSearch,
  onOpenImport,
  signedIn,
}: AppHeaderProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-ink/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-aurora-1 via-aurora-2 to-aurora-3 font-black text-ink">
            V
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            Vela<span className="text-aurora-2">.tv</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-300 lg:flex">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSection(item.id);
                onCategory(null);
              }}
              className={
                section === item.id && !activeCategory
                  ? "text-foreground"
                  : "transition-colors hover:text-foreground"
              }
            >
              {item.label}
            </button>
          ))}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={`flex items-center gap-1 transition-colors hover:text-foreground ${
                activeCategory ? "text-foreground" : ""
              }`}
            >
              {activeCategory ?? "Categorias"}
              <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="absolute left-0 top-full mt-3 max-h-[60vh] w-72 overflow-y-auto rounded-2xl border border-white/10 bg-panel/95 p-2 shadow-2xl backdrop-blur-xl">
                {categories.length === 0 && (
                  <p className="px-3 py-2 text-xs text-slate-500">Nenhuma categoria carregada.</p>
                )}
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      onCategory(cat);
                      setOpen(false);
                    }}
                    className="block w-full truncate rounded-xl px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-foreground"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
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
          <Link
            to="/conta"
            className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5 sm:inline-block"
          >
            {signedIn ? "Minha conta" : "Entrar / Criar conta"}
          </Link>
          {signedIn && (
            <button
              onClick={onOpenImport}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-aurora-1 via-aurora-2 to-aurora-3 px-4 py-2 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
            >
              <Plus className="size-4" strokeWidth={3} />
              <span className="hidden sm:inline">Carregar lista M3U</span>
              <span className="sm:hidden">M3U</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
