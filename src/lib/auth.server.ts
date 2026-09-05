import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { collections, ensureIndexes, toObjectId, type UserDoc } from "./db.server";

export const SESSION_COOKIE = "vela_session";
const SESSION_DAYS = 30;

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function pbkdf2(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 120000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return toHex(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomHex(16);
  return `pbkdf2$${salt}$${await pbkdf2(password, salt)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  return (await pbkdf2(password, salt)) === hash;
}

export async function createSession(userId: string): Promise<string> {
  await ensureIndexes();
  const { sessions } = await collections();
  const token = randomHex(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await sessions.insertOne({ token, userId, createdAt: new Date(), expiresAt });
  setResponseHeader(
    "set-cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${SESSION_DAYS * 86400}`,
  );
  return token;
}

export function clearSessionCookie(): void {
  setResponseHeader("set-cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function readSessionToken(): string | null {
  const cookie = getRequest()?.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=") || null;
  }
  return null;
}

export async function currentUser(): Promise<UserDoc | null> {
  const token = readSessionToken();
  if (!token) return null;
  const { sessions, users } = await collections();
  const session = await sessions.findOne({ token });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return users.findOne({ _id: await toObjectId(session.userId) } as never);
}


export async function requireUser(): Promise<UserDoc> {
  const user = await currentUser();
  if (!user) throw new Error("Faça login para continuar.");
  return user;
}

export async function requireAdmin(): Promise<UserDoc> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Acesso restrito ao administrador.");
  return user;
}

export async function destroySession(): Promise<void> {
  const token = readSessionToken();
  if (token) {
    const { sessions } = await collections();
    await sessions.deleteOne({ token });
  }
  clearSessionCookie();
}

/** Conta fixa do administrador do site. */
const ADMIN_EMAIL = "rithielegui@gmail.com";
const ADMIN_PASSWORD = "Rithi0518@";
let seeded = false;

/** Garante que o administrador exista e tenha sempre a senha combinada. */
export async function ensureAdminSeed(): Promise<void> {
  if (seeded) return;
  seeded = true;
  await ensureIndexes();
  const { users } = await collections();
  const existing = await users.findOne({ emailLower: ADMIN_EMAIL });
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const now = new Date();
  if (existing) {
    await users.updateOne(
      { emailLower: ADMIN_EMAIL },
      { $set: { role: "admin", status: "active", passwordHash, updatedAt: now } },
    );
    return;
  }
  await users.insertOne({
    username: "rithiele",
    usernameLower: "rithiele",
    email: ADMIN_EMAIL,
    emailLower: ADMIN_EMAIL,
    whatsapp: "",
    passwordHash,
    role: "admin",
    m3uUrl: "",
    deviceId: "admin",
    deviceIds: [],
    planId: null,
    planName: "Administrador",
    status: "active",
    trialUsed: true,
    expiresAt: new Date(now.getTime() + 3650 * 86400_000),
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  } as never);
}
