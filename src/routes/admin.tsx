import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminDeletePlan,
  adminOverview,
  adminSaveInfinitePay,
  adminSavePlan,
  adminUpdateUser,
  type AdminPlan,
  type AdminUserRow,
} from "@/lib/admin.functions";
import {
  adminClearShowcase,
  adminForgetShowcaseSource,
  adminImportShowcase,
  adminSaveSupport,
} from "@/lib/showcase.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel do administrador — Vela.tv" },
      {
        name: "description",
        content:
          "Gerencie clientes, planos, vencimentos e pagamentos InfinitePay da sua plataforma Vela.tv.",
      },
      { property: "og:title", content: "Painel do administrador — Vela.tv" },
      {
        property: "og:description",
        content: "Clientes, planos, vencimentos e pagamentos em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const field =
  "rounded-lg border border-white/10 bg-ink/60 px-3 py-2 text-sm text-foreground outline-none focus:border-aurora-2/60";

function AdminPage() {
  const overview = useServerFn(adminOverview);
  const savePlan = useServerFn(adminSavePlan);
  const deletePlan = useServerFn(adminDeletePlan);
  const saveHandle = useServerFn(adminSaveInfinitePay);
  const updateUser = useServerFn(adminUpdateUser);
  const saveSupport = useServerFn(adminSaveSupport);
  const importShowcase = useServerFn(adminImportShowcase);
  const clearShowcase = useServerFn(adminClearShowcase);
  const forgetShowcase = useServerFn(adminForgetShowcaseSource);

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, trial: 0, paid: 0 });
  const [handle, setHandle] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [showcaseUrl, setShowcaseUrl] = useState("");
  const [showcaseCount, setShowcaseCount] = useState(0);
  const [showcaseInfo, setShowcaseInfo] = useState("");
  const [newPlan, setNewPlan] = useState({ id: "", name: "", days: 30, price: 0, description: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await overview({ data: { search, filter } });
      if ("unauthorized" in data) {
        setDenied(true);
        setError(data.message ?? "Acesso restrito.");
        return;
      }
      setDenied(false);
      setRows(data.rows);
      setPlans(data.plans);
      setStats(data.stats);
      setHandle(data.infinitepayHandle);
      setWhatsapp(data.supportWhatsapp);
      setShowcaseCount(data.showcaseCount);
      setShowcaseUrl(data.showcaseSource?.url ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [overview, search, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na operação.");
    }
  };

  if (denied) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink px-6 text-center text-slate-100">
        <div>
          <h1 className="text-2xl font-black text-foreground">Área restrita</h1>
          <p className="mt-2 text-sm text-slate-400">
            Entre com a conta de administrador para abrir este painel.
          </p>
          <Link
            to="/conta"
            className="mt-5 inline-block rounded-full bg-aurora-2 px-6 py-3 text-sm font-bold text-ink"
          >
            Entrar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-ink text-slate-100">
      <main className="mx-auto max-w-[1500px] px-6 py-10">
        <Link to="/" className="font-mono text-xs text-aurora-2 hover:underline">
          ← catálogo
        </Link>
        <h1 className="mt-3 text-3xl font-black text-foreground">Painel do administrador</h1>
        {error && <p className="mt-4 rounded-xl bg-live/10 p-3 text-sm text-live">{error}</p>}

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            ["Clientes", stats.total],
            ["Ativos", stats.active],
            ["Vencidos", stats.expired],
            ["Em teste", stats.trial],
            ["Pagamentos", stats.paid],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-white/10 bg-panel/60 p-4">
              <div className="font-mono text-[10px] uppercase text-slate-500">{label}</div>
              <div className="mt-1 text-2xl font-black text-aurora-2">{value}</div>
            </div>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-white/10 bg-panel/60 p-5">
          <h2 className="text-lg font-bold text-foreground">InfinitePay</h2>
          <p className="mt-1 text-xs text-slate-400">
            Informe o nome da sua conta InfinitePay (o $nome). Os pagamentos renovam o acesso
            automaticamente pelo aviso enviado para /api/public/infinitepay-webhook.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              className={field}
              placeholder="$suaconta"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
            <button
              onClick={() => void act(() => saveHandle({ data: { handle } }))}
              className="rounded-full bg-aurora-2 px-5 py-2 text-xs font-bold text-ink"
            >
              Salvar
            </button>
          </div>
        </section>


        <section className="mt-8 rounded-2xl border border-white/10 bg-panel/60 p-5">
          <h2 className="text-lg font-bold text-foreground">Visitantes sem conta</h2>
          <p className="mt-1 text-xs text-slate-400">
            Quem entra no site sem conta vê só as capas abaixo e o convite para criar conta ou
            chamar no WhatsApp.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              className={field}
              placeholder="WhatsApp com DDD (ex.: 5511999999999)"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
            <button
              onClick={() => void act(() => saveSupport({ data: { whatsapp } }))}
              className="rounded-full bg-aurora-2 px-5 py-2 text-xs font-bold text-ink"
            >
              Salvar WhatsApp
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <input
              className={`${field} min-w-[320px] flex-1`}
              placeholder="Link da lista M3U só para as capas"
              value={showcaseUrl}
              onChange={(e) => setShowcaseUrl(e.target.value)}
            />
            <button
              onClick={() => {
                setShowcaseInfo("Baixando a lista e guardando as capas…");
                void act(async () => {
                  const res = await importShowcase({ data: { url: showcaseUrl } });
                  setShowcaseInfo(`${res.total} capas guardadas.`);
                });
              }}
              className="rounded-full bg-aurora-2 px-5 py-2 text-xs font-bold text-ink"
            >
              Guardar capas
            </button>
            <button
              onClick={() => {
                setShowcaseUrl("");
                setShowcaseInfo("Lista removida — as capas continuam salvas.");
                void act(() => forgetShowcase({}));
              }}
              className="text-xs text-slate-300 hover:underline"
            >
              remover a lista (manter capas)
            </button>
            <button
              onClick={() => {
                setShowcaseInfo("Capas apagadas.");
                void act(() => clearShowcase({}));
              }}
              className="text-xs text-live hover:underline"
            >
              apagar capas
            </button>
          </div>
          <p className="mt-2 font-mono text-[11px] text-slate-500">
            {showcaseCount} capas guardadas. {showcaseInfo}
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-panel/60 p-5">
          <h2 className="text-lg font-bold text-foreground">Planos</h2>
          <div className="mt-3 space-y-2">
            {plans.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink/50 px-4 py-3"
              >
                <span className="text-sm font-semibold">
                  {p.name} · {p.days} dias · R$ {p.price.toFixed(2)}
                  {p.description ? ` · ${p.description}` : ""}
                  {p.active ? "" : " · inativo"}
                </span>
                <span className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditingId(p.id);
                      setNewPlan({
                        id: p.id,
                        name: p.name,
                        days: p.days,
                        price: p.price,
                        description: p.description,
                      });
                    }}
                    className="text-xs text-aurora-2 hover:underline"
                  >
                    editar
                  </button>
                  <button
                    onClick={() =>
                      void act(() => savePlan({ data: { ...p, active: !p.active } }))
                    }
                    className="text-xs text-slate-300 hover:underline"
                  >
                    {p.active ? "desativar" : "ativar"}
                  </button>
                  <button
                    onClick={() => void act(() => deletePlan({ data: { id: p.id } }))}
                    className="text-xs text-live hover:underline"
                  >
                    remover
                  </button>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              className={field}
              placeholder="código (ex.: mensal)"
              value={newPlan.id}
              onChange={(e) => setNewPlan({ ...newPlan, id: e.target.value })}
            />
            <input
              className={field}
              placeholder="nome"
              value={newPlan.name}
              onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
            />
            <input
              className={`${field} w-24`}
              type="number"
              placeholder="dias"
              value={newPlan.days}
              onChange={(e) => setNewPlan({ ...newPlan, days: Number(e.target.value) })}
            />
            <input
              className={`${field} w-28`}
              type="number"
              step="0.01"
              placeholder="preço"
              value={newPlan.price}
              onChange={(e) => setNewPlan({ ...newPlan, price: Number(e.target.value) })}
            />
            <input
              className={field}
              placeholder="descrição"
              value={newPlan.description}
              onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
            />
            <button
              onClick={() =>
                void act(() => savePlan({ data: { ...newPlan, active: true } })).then(() =>
                  setNewPlan({ id: "", name: "", days: 30, price: 0, description: "" }),
                )
              }
              className="rounded-full bg-aurora-2 px-5 py-2 text-xs font-bold text-ink"
            >
              Salvar plano
            </button>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-panel/60 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-foreground">Clientes</h2>
            <input
              className={field}
              placeholder="buscar nome, e-mail ou WhatsApp"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={field}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="expired">Vencidos</option>
              <option value="trial">Em teste</option>
              <option value="blocked">Bloqueados</option>
            </select>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="font-mono text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="py-2">Usuário</th>
                  <th>Contato</th>
                  <th>Plano</th>
                  <th>Situação</th>
                  <th>Vence</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Carregando…
                    </td>
                  </tr>
                )}
                {rows.map((u) => (
                  <tr key={u.id} className="border-t border-white/5">
                    <td className="py-3 font-semibold">{u.username}</td>
                    <td className="text-xs text-slate-300">
                      {u.email}
                      <br />
                      {u.whatsapp}
                    </td>
                    <td className="text-xs">{u.planName ?? "—"}</td>
                    <td className="text-xs font-bold">
                      {u.status === "expired"
                        ? "Vencido"
                        : u.status === "blocked"
                          ? "Bloqueado"
                          : u.status === "trial"
                            ? "Teste"
                            : "Ativo"}
                    </td>
                    <td className="text-xs">
                      {new Date(u.expiresAt).toLocaleDateString("pt-BR")} ({u.daysLeft}d)
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2 py-2">
                        <select
                          className={`${field} py-1 text-xs`}
                          defaultValue=""
                          onChange={(e) => {
                            const planId = e.target.value;
                            if (!planId) return;
                            void act(() =>
                              updateUser({ data: { userId: u.id, action: "setPlan", planId } }),
                            );
                            e.target.value = "";
                          }}
                        >
                          <option value="">aplicar plano…</option>
                          {plans.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="text-xs text-aurora-2 hover:underline"
                          onClick={() =>
                            void act(() =>
                              updateUser({ data: { userId: u.id, action: "addDays", days: 30 } }),
                            )
                          }
                        >
                          +30d
                        </button>
                        <button
                          className="text-xs text-slate-300 hover:underline"
                          onClick={() =>
                            void act(() =>
                              updateUser({
                                data: {
                                  userId: u.id,
                                  action: u.status === "blocked" ? "unblock" : "block",
                                },
                              }),
                            )
                          }
                        >
                          {u.status === "blocked" ? "desbloquear" : "bloquear"}
                        </button>
                        <button
                          className="text-xs text-slate-300 hover:underline"
                          onClick={() =>
                            void act(() =>
                              updateUser({ data: { userId: u.id, action: "resetDevice" } }),
                            )
                          }
                        >
                          liberar aparelho
                        </button>
                        <button
                          className="text-xs text-live hover:underline"
                          onClick={() => {
                            if (confirm(`Excluir ${u.username}?`))
                              void act(() =>
                                updateUser({ data: { userId: u.id, action: "delete" } }),
                              );
                          }}
                        >
                          excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
