import { useSession } from "@tanstack/react-start/server";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

type LicenseSession = { codeId?: string };
type AdminSession = { admin?: boolean };

function cfg(name: string, maxAgeDays: number) {
  return {
    password: process.env["SESSION_SECRET"]!,
    name,
    maxAge: 60 * 60 * 24 * maxAgeDays,
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/", partitioned: true },
  };
}

export const licenseSession = () => useSession<LicenseSession>(cfg("sawtuk-license", 365));
export const adminSession = () => useSession<AdminSession>(cfg("sawtuk-admin", 1));

export function safeEqual(a: string, b: string) {
  const x = createHash("sha256").update(a, "utf8").digest();
  const y = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(x, y);
}

export async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newCode() {
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `SWT-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export type CodeRow = {
  id: string;
  code: string;
  label: string | null;
  max_uses: number;
  uses: number;
  duration_days: number;
  first_used_at: string | null;
  active: boolean;
  created_at: string;
};

export function codeState(row: CodeRow) {
  let daysLeft = row.duration_days;
  let expired = false;
  if (row.first_used_at) {
    const end = new Date(row.first_used_at).getTime() + row.duration_days * 86400000;
    const ms = end - Date.now();
    daysLeft = Math.max(0, Math.ceil(ms / 86400000));
    expired = ms <= 0;
  }
  return { daysLeft, expired, usesLeft: Math.max(0, row.max_uses - row.uses) };
}

/** Throws unless the current visitor holds a valid, active activation code. */
export async function requireLicense() {
  const s = await licenseSession();
  const id = s.data.codeId;
  if (!id) throw new Error("يلزم كود تفعيل صالح");
  const sb = await db();
  const { data } = await sb.from("activation_codes").select("*").eq("id", id).maybeSingle();
  if (!data || !data.active || codeState(data as CodeRow).expired) {
    throw new Error("انتهت صلاحية كود التفعيل");
  }
  return data as CodeRow;
}

export async function requireAdmin() {
  const s = await adminSession();
  if (!s.data.admin) throw new Error("غير مصرّح");
}

export async function getOpenAIKey() {
  const sb = await db();
  const { data } = await sb.from("app_settings").select("value").eq("key", "openai_api_key").maybeSingle();
  if (!data?.value) throw new Error("لم يُضبط مفتاح OpenAI بعد. تواصل مع الإدارة.");
  return data.value;
}
