import type { UserDoc } from "./db.server";
import type { AccountView } from "./account.functions";

/** Converte o registro do banco no formato que o site mostra. */
export function toAccountView(user: UserDoc): AccountView {
  const unlimited = user.role === "admin";
  const expires = new Date(user.expiresAt);
  const daysLeft = Math.ceil((expires.getTime() - Date.now()) / 86400_000);
  const status: AccountView["status"] =
    unlimited ? "active" : user.status === "blocked" ? "blocked" : daysLeft <= 0 ? "expired" : user.status;
  return {
    id: String((user as { _id?: unknown })._id ?? ""),
    username: user.username,
    email: user.email,
    whatsapp: user.whatsapp,
    role: user.role,
    status,
    planName: user.planName,
    m3uUrl: user.m3uUrl,
    expiresAt: expires.toISOString(),
    daysLeft: unlimited ? 0 : Math.max(0, daysLeft),
    unlimited,
    createdAt: new Date(user.createdAt).toISOString(),
  };
}
