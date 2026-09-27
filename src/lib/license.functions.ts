import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  licenseSession, adminSession, safeEqual, db, newCode, codeState, requireAdmin, type CodeRow,
} from "./license.server";

// ---------- Users ----------
export const getLicenseStatus = createServerFn({ method: "GET" }).handler(async () => {
  const s = await licenseSession();
  if (!s.data.codeId) return { active: false as const };
  const sb = await db();
  const { data } = await sb.from("activation_codes").select("*").eq("id", s.data.codeId).maybeSingle();
  if (!data || !data.active) return { active: false as const };
  const st = codeState(data as CodeRow);
  if (st.expired) return { active: false as const, expired: true };
  return { active: true as const, daysLeft: st.daysLeft };
});

export const redeemCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().trim().min(4).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const code = data.code.toUpperCase();
    const { data: row } = await sb.from("activation_codes").select("*").eq("code", code).maybeSingle();
    if (!row || !row.active) return { ok: false as const, error: "الكود غير صحيح أو موقوف" };
    const st = codeState(row as CodeRow);
    if (st.expired) return { ok: false as const, error: "انتهت صلاحية هذا الكود" };
    const s = await licenseSession();
    if (s.data.codeId === row.id) return { ok: true as const };
    if (st.usesLeft <= 0) return { ok: false as const, error: "استُنفدت مرات استخدام هذا الكود" };
    const { error } = await sb
      .from("activation_codes")
      .update({ uses: row.uses + 1, first_used_at: row.first_used_at ?? new Date().toISOString() })
      .eq("id", row.id)
      .eq("uses", row.uses);
    if (error) return { ok: false as const, error: "تعذّر التفعيل، حاول مجدداً" };
    await s.update({ codeId: row.id });
    return { ok: true as const };
  });

export const signOutLicense = createServerFn({ method: "POST" }).handler(async () => {
  const s = await licenseSession();
  await s.clear();
  return { ok: true };
});

// ---------- Admin ----------
export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const s = await adminSession();
  return { admin: !!s.data.admin };
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ passcode: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_PASSCODE"];
    if (!expected || !safeEqual(data.passcode, expected)) {
      await new Promise((r) => setTimeout(r, 800));
      return { ok: false as const };
    }
    const s = await adminSession();
    await s.update({ admin: true });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const s = await adminSession();
  await s.clear();
  return { ok: true };
});

export const adminListCodes = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const sb = await db();
  const { data, error } = await sb.from("activation_codes").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as CodeRow[]).map((r) => ({ ...r, ...codeState(r) }));
});

export const adminCreateCodes = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      count: z.number().int().min(1).max(100),
      maxUses: z.number().int().min(1).max(10000),
      durationDays: z.number().int().min(1).max(3650),
      label: z.string().trim().max(80).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();
    const rows = Array.from({ length: data.count }, () => ({
      code: newCode(),
      max_uses: data.maxUses,
      duration_days: data.durationDays,
      label: data.label || null,
    }));
    const { data: out, error } = await sb.from("activation_codes").insert(rows).select("code");
    if (error) throw new Error(error.message);
    return out.map((r) => r.code);
  });

export const adminUpdateCode = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), action: z.enum(["toggle", "delete"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();
    if (data.action === "delete") {
      await sb.from("activation_codes").delete().eq("id", data.id);
    } else {
      const { data: row } = await sb.from("activation_codes").select("active").eq("id", data.id).single();
      await sb.from("activation_codes").update({ active: !row?.active }).eq("id", data.id);
    }
    return { ok: true };
  });

export const adminGetSettings = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const sb = await db();
  const { data } = await sb.from("app_settings").select("value, updated_at").eq("key", "openai_api_key").maybeSingle();
  const v = data?.value ?? "";
  return {
    hasKey: !!v,
    masked: v ? `${v.slice(0, 5)}…${v.slice(-4)}` : "",
    updatedAt: data?.updated_at ?? null,
  };
});

export const adminSaveOpenAIKey = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ key: z.string().trim().min(20).max(300) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const test = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${data.key}` },
    });
    if (!test.ok) return { ok: false as const, error: `رفضت OpenAI المفتاح (${test.status})` };
    const sb = await db();
    const { error } = await sb
      .from("app_settings")
      .upsert({ key: "openai_api_key", value: data.key, updated_at: new Date().toISOString() });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
