import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Dados da conta que o site pode mostrar (sem senha). */
export interface AccountView {
  id: string;
  username: string;
  email: string;
  whatsapp: string;
  role: "admin" | "user";
  status: "trial" | "active" | "expired" | "blocked";
  planName: string | null;
  m3uUrl: string;
  expiresAt: string;
  daysLeft: number;
  createdAt: string;
}

const TRIAL_DAYS = 3;

/** Resultado esperado: sucesso com a conta, ou recado amigável de erro. */
export type AccountResult =
  | { ok: true; account: AccountView }
  | { ok: false; message: string };

const registerSchema = z.object({
  username: z.string().trim().min(3).max(32),
  email: z.string().trim().email(),
  whatsapp: z.string().trim().min(8).max(24),
  password: z.string().min(6).max(200),
  m3uUrl: z.string().trim().max(2000),
  deviceId: z.string().trim().min(8).max(128),
});

export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data }): Promise<AccountResult> => {
    const { collections, ensureIndexes } = await import("./db.server");
    const { hashPassword, createSession } = await import("./auth.server");
    const { toAccountView } = await import("./account.server");
    await ensureIndexes();
    const { users, devices } = await collections();

    const emailLower = data.email.toLowerCase();
    const usernameLower = data.username.toLowerCase();

    if (await users.findOne({ emailLower }))
      return { ok: false, message: "Este e-mail já tem conta." };
    if (await users.findOne({ usernameLower }))
      return { ok: false, message: "Este nome de usuário já está em uso." };

    // Bloqueio de teste repetido no mesmo navegador/aparelho.
    const device = await devices.findOne({ deviceId: data.deviceId });
    if (device) {
      await devices.updateOne({ deviceId: data.deviceId }, { $inc: { attempts: 1 } });
      return {
        ok: false,
        message:
          "Este aparelho já usou o teste gratuito de 3 dias. Entre na sua conta ou escolha um plano.",
      };
    }

    const now = new Date();
    const doc = {
      username: data.username,
      usernameLower,
      email: data.email,
      emailLower,
      whatsapp: data.whatsapp,
      passwordHash: await hashPassword(data.password),
      role: ((await users.countDocuments({}, { limit: 1 })) === 0 ? "admin" : "user") as
        | "admin"
        | "user",
      m3uUrl: data.m3uUrl,
      deviceId: data.deviceId,
      deviceIds: [data.deviceId],
      planId: null,
      planName: "Teste grátis",
      status: "trial" as const,
      trialUsed: true,
      expiresAt: new Date(now.getTime() + TRIAL_DAYS * 86400_000),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };
    const result = await users.insertOne(doc as never);
    const userId = String(result.insertedId);
    await devices.insertOne({
      deviceId: data.deviceId,
      firstUserId: userId,
      trialUsedAt: now,
      attempts: 1,
    });
    await createSession(userId);
    return toAccountView({ ...doc, _id: result.insertedId } as never);
  });

const loginSchema = z.object({
  email: z.string().trim().min(3),
  password: z.string().min(1),
  deviceId: z.string().trim().max(128).optional(),
});

export const loginAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => loginSchema.parse(data))
  .handler(async ({ data }): Promise<AccountView> => {
    const { collections } = await import("./db.server");
    const { verifyPassword, createSession } = await import("./auth.server");
    const { toAccountView } = await import("./account.server");
    const { users } = await collections();
    const id = data.email.toLowerCase();
    const user = await users.findOne({ $or: [{ emailLower: id }, { usernameLower: id }] });
    if (!user || !(await verifyPassword(data.password, user.passwordHash)))
      throw new Error("E-mail ou senha incorretos.");
    if (user.status === "blocked") throw new Error("Conta bloqueada. Fale com o suporte.");
    const update: Record<string, unknown> = { lastLoginAt: new Date() };
    await users.updateOne(
      { _id: (user as { _id: unknown })._id } as never,
      data.deviceId
        ? { $set: update, $addToSet: { deviceIds: data.deviceId } }
        : { $set: update },
    );
    await createSession(String((user as { _id: unknown })._id));
    return toAccountView(user);
  });

export const logoutAccount = createServerFn({ method: "POST" }).handler(async () => {
  const { destroySession } = await import("./auth.server");
  await destroySession();
  return { ok: true };
});

export const getMyAccount = createServerFn({ method: "POST" }).handler(
  async (): Promise<AccountView | null> => {
    const { currentUser } = await import("./auth.server");
    const { toAccountView } = await import("./account.server");
    const user = await currentUser();
    return user ? toAccountView(user) : null;
  },
);

export const saveMyPlaylistUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ m3uUrl: z.string().trim().max(2000) }).parse(data))
  .handler(async ({ data }) => {
    const { collections } = await import("./db.server");
    const { requireUser } = await import("./auth.server");
    const user = await requireUser();
    const { users } = await collections();
    await users.updateOne({ _id: (user as { _id: unknown })._id } as never, {
      $set: { m3uUrl: data.m3uUrl, updatedAt: new Date() },
    });
    return { ok: true };
  });

/** Planos ativos que aparecem para o cliente. */
export const listActivePlans = createServerFn({ method: "GET" }).handler(async () => {
  const { collections } = await import("./db.server");
  const { plans } = await collections();
  const docs = await plans.find({ active: true }).sort({ price: 1 }).toArray();
  return docs.map((p) => ({
    id: p.id,
    name: p.name,
    days: p.days,
    price: p.price,
    description: p.description,
  }));
});

/** Gera o link de pagamento InfinitePay para um plano. */
export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ planId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { collections } = await import("./db.server");
    const { requireUser } = await import("./auth.server");
    const { buildInfinitePayLink } = await import("./infinitepay.server");
    const user = await requireUser();
    const { plans, payments, settings } = await collections();
    const plan = await plans.findOne({ id: data.planId, active: true });
    if (!plan) throw new Error("Plano indisponível.");
    const handleDoc = await settings.findOne({ key: "infinitepay_handle" });
    const handle = String(handleDoc?.value ?? "").trim();
    if (!handle) throw new Error("Pagamento ainda não configurado pelo administrador.");

    const orderId = `vela-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await payments.insertOne({
      orderId,
      userId: String((user as { _id: unknown })._id),
      planId: plan.id,
      amount: plan.price,
      status: "pending",
      provider: "infinitepay",
      createdAt: new Date(),
      paidAt: null,
    });
    return { url: buildInfinitePayLink(handle, plan.name, plan.price, orderId) };
  });
