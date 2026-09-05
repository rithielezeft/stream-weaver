import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface AdminUserRow {
  id: string;
  username: string;
  email: string;
  whatsapp: string;
  role: string;
  status: string;
  planName: string | null;
  m3uUrl: string;
  expiresAt: string;
  daysLeft: number;
  createdAt: string;
  lastLoginAt: string | null;
  deviceId: string;
}

export interface AdminPlan {
  id: string;
  name: string;
  days: number;
  price: number;
  description: string;
  active: boolean;
}

export const adminOverview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ search: z.string().trim().max(120).optional(), filter: z.string().optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { collections } = await import("./db.server");
    const { requireAdmin } = await import("./auth.server");
    await requireAdmin();
    const { users, plans, settings, payments } = await collections();

    const now = new Date();
    const query: Record<string, unknown> = {};
    if (data.search) {
      const rx = new RegExp(data.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query["$or"] = [{ username: rx }, { email: rx }, { whatsapp: rx }];
    }
    if (data.filter === "active") query["expiresAt"] = { $gt: now };
    if (data.filter === "expired") query["expiresAt"] = { $lte: now };
    if (data.filter === "trial") query["status"] = "trial";
    if (data.filter === "blocked") query["status"] = "blocked";

    const docs = await users.find(query).sort({ createdAt: -1 }).limit(500).toArray();
    const rows: AdminUserRow[] = docs.map((u) => {
      const expires = new Date(u.expiresAt);
      const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / 86400_000);
      return {
        id: String((u as { _id: unknown })._id),
        username: u.username,
        email: u.email,
        whatsapp: u.whatsapp,
        role: u.role,
        status: u.status === "blocked" ? "blocked" : daysLeft <= 0 ? "expired" : u.status,
        planName: u.planName,
        m3uUrl: u.m3uUrl,
        expiresAt: expires.toISOString(),
        daysLeft,
        createdAt: new Date(u.createdAt).toISOString(),
        lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
        deviceId: u.deviceId,
      };
    });

    const [total, active, expired, trial, planDocs, handleDoc, paid] = await Promise.all([
      users.countDocuments({}),
      users.countDocuments({ expiresAt: { $gt: now }, status: { $ne: "blocked" } }),
      users.countDocuments({ expiresAt: { $lte: now } }),
      users.countDocuments({ status: "trial" }),
      plans.find({}).sort({ price: 1 }).toArray(),
      settings.findOne({ key: "infinitepay_handle" }),
      payments.countDocuments({ status: "paid" }),
    ]);

    return {
      rows,
      stats: { total, active, expired, trial, paid },
      plans: planDocs.map((p) => ({
        id: p.id,
        name: p.name,
        days: p.days,
        price: p.price,
        description: p.description,
        active: p.active,
      })) as AdminPlan[],
      infinitepayHandle: String(handleDoc?.value ?? ""),
    };
  });

export const adminSavePlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1).max(60),
        days: z.number().int().min(1).max(3650),
        price: z.number().min(0).max(100000),
        description: z.string().trim().max(200).default(""),
        active: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { collections, ensureIndexes } = await import("./db.server");
    const { requireAdmin } = await import("./auth.server");
    await requireAdmin();
    await ensureIndexes();
    const { plans } = await collections();
    await plans.updateOne(
      { id: data.id },
      { $set: { ...data }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    return { ok: true };
  });

export const adminDeletePlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { collections } = await import("./db.server");
    const { requireAdmin } = await import("./auth.server");
    await requireAdmin();
    const { plans } = await collections();
    await plans.deleteOne({ id: data.id });
    return { ok: true };
  });

export const adminSaveInfinitePay = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ handle: z.string().trim().max(60) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { collections, ensureIndexes } = await import("./db.server");
    const { requireAdmin } = await import("./auth.server");
    await requireAdmin();
    await ensureIndexes();
    const { settings } = await collections();
    await settings.updateOne(
      { key: "infinitepay_handle" },
      { $set: { value: data.handle.replace(/^\$/, "") } },
      { upsert: true },
    );
    return { ok: true };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string(),
        action: z.enum(["setPlan", "addDays", "block", "unblock", "resetDevice", "delete"]),
        planId: z.string().optional(),
        days: z.number().int().min(-3650).max(3650).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { collections } = await import("./db.server");
    const { requireAdmin } = await import("./auth.server");
    const { ObjectId } = await import("mongodb");
    await requireAdmin();
    const { users, plans, devices } = await collections();
    const _id = new ObjectId(data.userId);
    const user = await users.findOne({ _id } as never);
    if (!user) throw new Error("Usuário não encontrado.");

    if (data.action === "delete") {
      await users.deleteOne({ _id } as never);
      return { ok: true };
    }
    if (data.action === "block") {
      await users.updateOne({ _id } as never, { $set: { status: "blocked" } });
      return { ok: true };
    }
    if (data.action === "unblock") {
      await users.updateOne({ _id } as never, { $set: { status: "active" } });
      return { ok: true };
    }
    if (data.action === "resetDevice") {
      await devices.deleteMany({ firstUserId: data.userId });
      return { ok: true };
    }
    if (data.action === "addDays") {
      const base = Math.max(new Date(user.expiresAt).getTime(), Date.now());
      await users.updateOne({ _id } as never, {
        $set: {
          expiresAt: new Date(base + (data.days ?? 0) * 86400_000),
          status: "active",
          updatedAt: new Date(),
        },
      });
      return { ok: true };
    }
    // setPlan
    const plan = await plans.findOne({ id: data.planId ?? "" });
    if (!plan) throw new Error("Plano não encontrado.");
    const base = Math.max(new Date(user.expiresAt).getTime(), Date.now());
    await users.updateOne({ _id } as never, {
      $set: {
        planId: plan.id,
        planName: plan.name,
        expiresAt: new Date(base + plan.days * 86400_000),
        status: "active",
        updatedAt: new Date(),
      },
    });
    return { ok: true };
  });
