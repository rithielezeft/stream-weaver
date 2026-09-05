import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyAccount,
  loginAccount,
  logoutAccount,
  registerAccount,
  listActivePlans,
  startCheckout,
  type AccountView,
} from "@/lib/account.functions";
import { getDeviceId } from "@/lib/device-id";

export const Route = createFileRoute("/conta")({
  head: () => ({
    meta: [
      { title: "Conta e teste grátis de 3 dias — Vela.tv" },
      {
        name: "description",
        content:
          "Crie sua conta na Vela.tv com WhatsApp e e-mail, ganhe 3 dias de teste e acompanhe o vencimento do seu plano.",
      },
      { property: "og:title", content: "Conta e teste grátis — Vela.tv" },
      {
        property: "og:description",
        content: "Crie sua conta, ganhe 3 dias de teste e renove seu plano automaticamente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContaPage,
});

interface Plan {
  id: string;
  name: string;
  days: number;
  price: number;
  description: string;
}

const field =
  "w-full rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-slate-500 focus:border-aurora-2/60";

function ContaPage() {
  const register = useServerFn(registerAccount);
  const login = useServerFn(loginAccount);
  const logout = useServerFn(logoutAccount);
  const me = useServerFn(getMyAccount);
  const plansFn = useServerFn(listActivePlans);
  const checkout = useServerFn(startCheckout);

  const [account, setAccount] = useState<AccountView | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    username: "",
    email: "",
    whatsapp: "",
    password: "",
    m3uUrl: "",
  });

  useEffect(() => {
    void Promise.all([me(), plansFn()])
      .then(([acc, pl]) => {
        setAccount(acc);
        setPlans(pl);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [me, plansFn]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const deviceId = getDeviceId();
      const res =
        mode === "register"
          ? await register({ data: { ...form, deviceId } })
          : await login({ data: { email: form.email, password: form.password, deviceId } });
      if (res.ok) setAccount(res.account);
      else setError(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível continuar.");
    } finally {
      setBusy(false);
    }
  };

  const pay = async (planId: string) => {
    setError("");
    try {
      const { url } = await checkout({ data: { planId } });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pagamento indisponível.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-slate-100">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/3 h-[42rem] w-[42rem] rounded-full bg-aurora-1/25 blur-[130px] animate-drift" />
        <div className="absolute right-[-10%] top-[10%] h-[38rem] w-[38rem] rounded-full bg-aurora-2/25 blur-[130px] animate-drift-reverse" />
      </div>

      <main className="relative z-10 mx-auto max-w-3xl px-6 py-12">
        <Link to="/" className="font-mono text-xs text-aurora-2 hover:underline">
          ← voltar ao catálogo
        </Link>

        {loading ? (
          <p className="mt-16 text-center text-sm text-slate-400">Carregando…</p>
        ) : account ? (
          <section className="mt-6 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-panel/60 p-8">
              <p className="font-mono text-xs uppercase text-aurora-2">Minha conta</p>
              <h1 className="mt-2 text-3xl font-black text-foreground">{account.username}</h1>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="font-mono text-[10px] uppercase text-slate-500">E-mail</dt>
                  <dd className="text-sm">{account.email}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-slate-500">WhatsApp</dt>
                  <dd className="text-sm">{account.whatsapp}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-slate-500">Plano</dt>
                  <dd className="text-sm">{account.planName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-slate-500">Situação</dt>
                  <dd className="text-sm font-bold">
                    {account.unlimited
                      ? "Ativo — ilimitado"
                      : account.status === "expired"
                      ? "Vencido"
                      : account.status === "blocked"
                        ? "Bloqueado"
                        : account.status === "trial"
                          ? `Teste — ${account.daysLeft} dia(s)`
                          : `Ativo — ${account.daysLeft} dia(s)`}
                  </dd>
                </div>
                {!account.unlimited && (
                  <div className="sm:col-span-2">
                    <dt className="font-mono text-[10px] uppercase text-slate-500">Vence em</dt>
                    <dd className="text-sm">
                      {new Date(account.expiresAt).toLocaleString("pt-BR")}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="mt-6 flex gap-3">
                {account.role === "admin" && (
                  <Link
                    to="/admin"
                    className="rounded-full bg-aurora-2 px-5 py-2 text-xs font-bold text-ink"
                  >
                    Painel do administrador
                  </Link>
                )}
                <button
                  onClick={async () => {
                    await logout({});
                    setAccount(null);
                  }}
                  className="rounded-full border border-white/10 px-5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
                >
                  Sair
                </button>
              </div>
            </div>

            {account.role !== "admin" && (
              <div className="rounded-3xl border border-white/10 bg-panel/60 p-8">
                <h2 className="text-xl font-bold text-foreground">Minha lista M3U</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Guarde aqui o link da sua lista. Depois é só abrir o catálogo para assistir.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={listUrl}
                    onChange={(e) => setListUrl(e.target.value)}
                    placeholder="http://servidor.com/get.php?username=...&type=m3u_plus"
                    className={field}
                  />
                  <button
                    type="button"
                    disabled={savingList}
                    onClick={async () => {
                      setSavingList(true);
                      setListMsg("");
                      try {
                        await saveList({ data: { m3uUrl: listUrl.trim() } });
                        setListMsg("Lista salva na sua conta.");
                      } catch {
                        setListMsg("Não foi possível salvar agora.");
                      } finally {
                        setSavingList(false);
                      }
                    }}
                    className="rounded-full bg-aurora-2 px-6 py-3 text-xs font-bold text-ink disabled:opacity-60"
                  >
                    {savingList ? "Salvando…" : "Salvar lista"}
                  </button>
                </div>
                {listMsg && <p className="mt-3 text-xs text-aurora-2">{listMsg}</p>}
                <Link
                  to="/"
                  className="mt-4 inline-block rounded-full border border-white/15 px-5 py-2 text-xs font-semibold text-slate-100 hover:bg-white/5"
                >
                  Abrir catálogo e carregar a lista
                </Link>
              </div>
            )}


            {account.role !== "admin" && plans.length > 0 && (
              <div className="rounded-3xl border border-white/10 bg-panel/60 p-8">
                <h2 className="text-xl font-bold text-foreground">Planos</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {plans.map((p) => (
                    <div key={p.id} className="rounded-2xl border border-white/10 bg-ink/50 p-5">
                      <div className="text-sm font-bold text-foreground">{p.name}</div>
                      <div className="mt-1 font-mono text-2xl text-aurora-2">
                        R$ {p.price.toFixed(2)}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {p.days} dias {p.description ? `· ${p.description}` : ""}
                      </p>
                      <button
                        onClick={() => void pay(p.id)}
                        className="mt-4 w-full rounded-full bg-aurora-2 py-2 text-xs font-bold text-ink"
                      >
                        Pagar e renovar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="mt-6 rounded-3xl border border-white/10 bg-panel/60 p-8">
            <p className="font-mono text-xs uppercase text-aurora-2">
              {mode === "register" ? "Criar conta · 3 dias grátis" : "Entrar"}
            </p>
            <h1 className="mt-2 text-3xl font-black text-foreground">
              {mode === "register" ? "Comece seu teste de 3 dias" : "Bem-vindo de volta"}
            </h1>

            <form onSubmit={submit} className="mt-6 space-y-3">
              {mode === "register" && (
                <input
                  className={field}
                  placeholder="Nome de usuário"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              )}
              <input
                className={field}
                placeholder={mode === "register" ? "E-mail" : "E-mail ou usuário"}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              {mode === "register" && (
                <input
                  className={field}
                  placeholder="WhatsApp com DDD"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  required
                />
              )}
              <input
                className={field}
                type="password"
                placeholder="Senha"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              {mode === "register" && (
                <input
                  className={field}
                  placeholder="Link da sua lista M3U (opcional)"
                  value={form.m3uUrl}
                  onChange={(e) => setForm({ ...form, m3uUrl: e.target.value })}
                />
              )}
              {error && <p className="text-sm text-live">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-aurora-2 py-3 text-sm font-bold text-ink disabled:opacity-60"
              >
                {busy
                  ? "Enviando…"
                  : mode === "register"
                    ? "Criar conta e liberar 3 dias"
                    : "Entrar"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode(mode === "register" ? "login" : "register");
                setError("");
              }}
              className="mt-3 w-full rounded-full border border-aurora-2/50 bg-aurora-2/10 py-3 text-sm font-bold text-aurora-2 transition-colors hover:bg-aurora-2/20"
            >
              {mode === "register"
                ? "Já tenho conta — entrar"
                : "Não tenho conta — criar com 3 dias grátis"}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
