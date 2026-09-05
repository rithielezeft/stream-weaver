import type { MongoClient, Collection, Db } from "mongodb";

/**
 * Conexão única com o MongoDB (MONGO_URL). As coleções usam o prefixo
 * `vela_` para não misturar com dados de outros sistemas no mesmo banco.
 */

export interface UserDoc {
  _id?: unknown;
  username: string;
  usernameLower: string;
  email: string;
  emailLower: string;
  whatsapp: string;
  passwordHash: string;
  role: "admin" | "user";
  m3uUrl: string;
  deviceId: string;
  deviceIds: string[];
  planId: string | null;
  planName: string | null;
  status: "trial" | "active" | "expired" | "blocked";
  trialUsed: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface PlanDoc {
  _id?: unknown;
  id: string;
  name: string;
  days: number;
  price: number;
  description: string;
  active: boolean;
  createdAt: Date;
}

export interface SessionDoc {
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface DeviceDoc {
  deviceId: string;
  firstUserId: string;
  trialUsedAt: Date;
  attempts: number;
}

export interface PaymentDoc {
  orderId: string;
  userId: string;
  planId: string;
  amount: number;
  status: "pending" | "paid" | "failed";
  provider: "infinitepay";
  createdAt: Date;
  paidAt: Date | null;
  raw?: unknown;
}

export interface SettingsDoc {
  key: string;
  value: unknown;
}

let clientPromise: Promise<MongoClient> | null = null;

async function getClient(): Promise<MongoClient> {
  const url = process.env["MONGO_URL"];
  if (!url) throw new Error("MONGO_URL não configurado.");
  if (!clientPromise) {
    const moduleName = "mongodb";
    clientPromise = import(/* @vite-ignore */ moduleName)
      .then((mod) =>
        new (mod as typeof import("mongodb")).MongoClient(url, {
          serverSelectionTimeoutMS: 10000,
        }).connect(),
      )
      .catch((error) => {
        clientPromise = null;
        throw error;
      });
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db();
}

export async function collections(): Promise<{
  users: Collection<UserDoc>;
  plans: Collection<PlanDoc>;
  sessions: Collection<SessionDoc>;
  devices: Collection<DeviceDoc>;
  payments: Collection<PaymentDoc>;
  settings: Collection<SettingsDoc>;
}> {
  const db = await getDb();
  return {
    users: db.collection<UserDoc>("vela_users"),
    plans: db.collection<PlanDoc>("vela_plans"),
    sessions: db.collection<SessionDoc>("vela_sessions"),
    devices: db.collection<DeviceDoc>("vela_devices"),
    payments: db.collection<PaymentDoc>("vela_payments"),
    settings: db.collection<SettingsDoc>("vela_settings"),
  };
}

let ensured = false;

/** Cria os índices na primeira chamada (email/usuário únicos, sessões, etc.). */
export async function ensureIndexes(): Promise<void> {
  if (ensured) return;
  const c = await collections();
  await Promise.all([
    c.users.createIndex({ emailLower: 1 }, { unique: true }),
    c.users.createIndex({ usernameLower: 1 }, { unique: true }),
    c.users.createIndex({ expiresAt: 1 }),
    c.sessions.createIndex({ token: 1 }, { unique: true }),
    c.devices.createIndex({ deviceId: 1 }, { unique: true }),
    c.payments.createIndex({ orderId: 1 }, { unique: true }),
    c.plans.createIndex({ id: 1 }, { unique: true }),
    c.settings.createIndex({ key: 1 }, { unique: true }),
  ]);
  ensured = true;
}

/** Carrega o driver em tempo de execução (evita empacotá-lo no bundle do worker). */
export async function loadMongo(): Promise<typeof import("mongodb")> {
  const moduleName = "mongodb";
  return (await import(/* @vite-ignore */ moduleName)) as typeof import("mongodb");
}

/** Converte uma string em ObjectId sem importar o driver estaticamente. */
export async function toObjectId(id: string): Promise<unknown> {
  const { ObjectId } = await loadMongo();
  return new ObjectId(id);
}
