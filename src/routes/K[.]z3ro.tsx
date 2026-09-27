import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Lock, Loader2, LogOut, KeyRound, Plus, Copy, Check, Trash2, Power, Settings2, Ticket, ShieldCheck,
} from "lucide-react";
import {
  adminStatus, adminLogin, adminLogout, adminListCodes, adminCreateCodes, adminUpdateCode,
  adminGetSettings, adminSaveOpenAIKey,
} from "@/lib/license.functions";

export const Route = createFileRoute("/K.z3ro")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — صوتُك" },
      { name: "description", content: "لوحة خاصة لإدارة أكواد التفعيل والإعدادات." },
      { property: "og:title", content: "لوحة التحكم — صوتُك" },
      { property: "og:description", content: "لوحة خاصة لإدارة أكواد التفعيل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const status = useServerFn(adminStatus);
  const q = useQuery({ queryKey: ["admin"], queryFn: () => status() });
  if (q.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-surface"><Loader2 className="size-8 animate-spin text-brand" /></div>;
  }
  return q.data?.admin ? <Dashboard /> : <AdminLogin />;
}

function AdminLogin() {
  const login = useServerFn(adminLogin);
  const qc = useQueryClient();
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(false);
    const r = await login({ data: { passcode: pass } });
    setBusy(false);
    if (r.ok) qc.invalidateQueries({ queryKey: ["admin"] });
    else setErr(true);
  };
  return (
    <div dir="rtl" className="grid min-h-screen place-items-center bg-surface p-5 font-body">
      <form onSubmit={submit} className="w-full max-w-sm rounded-4xl border border-line bg-card p-7 shadow-card">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-ink text-background"><Lock className="size-6" /></div>
        <h1 className="mt-4 text-center font-display text-xl font-extrabold text-foreground">دخول الإدارة</h1>
        <label htmlFor="pass" className="mt-6 block text-sm font-bold text-foreground">رمز المرور</label>
        <input
          id="pass" type="password" dir="ltr" value={pass} onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        {err && <p className="mt-2 text-sm font-bold text-destructive">رمز المرور غير صحيح</p>}
        <button disabled={busy || !pass} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3 font-display font-extrabold text-background shadow-ink disabled:opacity-50">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />} دخول
        </button>
      </form>
    </div>
  );
}

function Dashboard() {
  const logout = useServerFn(adminLogout);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"codes" | "settings">("codes");
  return (
    <div dir="rtl" className="min-h-screen bg-surface font-body text-foreground">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="font-display text-lg font-extrabold">لوحة إدارة صوتُك</p>
            <p className="text-xs text-muted-foreground">الأكواد والاشتراكات والإعدادات</p>
          </div>
          <div className="flex items-center gap-2">
            {(["codes", "settings"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${tab === t ? "bg-brand text-primary-foreground shadow-brand" : "text-muted-foreground hover:bg-muted"}`}>
                {t === "codes" ? <Ticket className="size-4" /> : <Settings2 className="size-4" />}
                {t === "codes" ? "الأكواد" : "الإعدادات"}
              </button>
            ))}
            <button onClick={async () => { await logout(); qc.invalidateQueries({ queryKey: ["admin"] }); }}
              aria-label="خروج" className="rounded-full p-2 text-muted-foreground hover:bg-muted"><LogOut className="size-4" /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{tab === "codes" ? <CodesPanel /> : <SettingsPanel />}</main>
    </div>
  );
}

function NumField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-bold">
      {label}
      <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-xl border border-line bg-surface px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" />
    </label>
  );
}

function CodesPanel() {
  const list = useServerFn(adminListCodes);
  const create = useServerFn(adminCreateCodes);
  const update = useServerFn(adminUpdateCode);
  const qc = useQueryClient();
  const codes = useQuery({ queryKey: ["admin-codes"], queryFn: () => list() });
  const [count, setCount] = useState(1);
  const [maxUses, setMaxUses] = useState(1);
  const [days, setDays] = useState(30);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: () => create({ data: { count, maxUses, durationDays: days, label: label || undefined } }),
    onSuccess: (c) => { setFresh(c); qc.invalidateQueries({ queryKey: ["admin-codes"] }); },
  });
  const act = useMutation({
    mutationFn: (v: { id: string; action: "toggle" | "delete" }) => update({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-codes"] }),
  });
  const copy = async (t: string) => { await navigator.clipboard.writeText(t); setCopied(t); setTimeout(() => setCopied(null), 1400); };

  const rows = codes.data ?? [];
  const activeCount = rows.filter((r) => r.active && !r.expired && r.usesLeft > 0).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <section className="self-start rounded-3xl border border-line bg-card p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-display text-base font-extrabold"><Plus className="size-4 text-brand" /> إنشاء أكواد جديدة</h2>
        <div className="mt-4 grid gap-3">
          <NumField label="عدد الأكواد" value={count} onChange={setCount} min={1} max={100} />
          <NumField label="مرات الاستخدام لكل كود (١ = استخدام واحد)" value={maxUses} onChange={setMaxUses} min={1} max={10000} />
          <NumField label="مدة الاشتراك (أيام)" value={days} onChange={setDays} min={1} max={3650} />
          <label className="flex flex-col gap-1.5 text-sm font-bold">
            اسم العميل / ملاحظة (اختياري)
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80}
              className="rounded-xl border border-line bg-surface px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <button onClick={() => gen.mutate()} disabled={gen.isPending}
            className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-brand py-3 font-display font-extrabold text-primary-foreground shadow-brand disabled:opacity-50">
            {gen.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} توليد
          </button>
          {gen.error && <p className="text-sm text-destructive">{(gen.error as Error).message}</p>}
        </div>
        {fresh.length > 0 && (
          <div className="mt-5 rounded-2xl border border-success/40 bg-success/10 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-success">
              <span>تم إنشاء {fresh.length.toLocaleString("ar-EG")} كود</span>
              <button onClick={() => copy(fresh.join("\n"))} className="underline">نسخ الكل</button>
            </div>
            <ul dir="ltr" className="space-y-1 font-mono text-sm">{fresh.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        )}
      </section>

      <section className="min-w-0 rounded-3xl border border-line bg-card p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-extrabold">كل الأكواد</h2>
          <div className="flex gap-2 text-xs font-bold">
            <span className="rounded-full bg-muted px-3 py-1">الإجمالي {rows.length.toLocaleString("ar-EG")}</span>
            <span className="rounded-full bg-success/15 px-3 py-1 text-success">صالحة {activeCount.toLocaleString("ar-EG")}</span>
          </div>
        </div>
        {codes.isLoading ? (
          <div className="grid h-40 place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">لا توجد أكواد بعد. أنشئ أول كود من القائمة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-start text-xs text-muted-foreground">
                <tr className="border-b border-line">
                  <th className="py-2 text-start">الكود</th><th className="text-start">العميل</th>
                  <th className="text-start">الاستخدام</th><th className="text-start">الأيام المتبقية</th>
                  <th className="text-start">الحالة</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const state = !r.active ? ["موقوف", "bg-muted text-muted-foreground"]
                    : r.expired ? ["منتهٍ", "bg-destructive/15 text-destructive"]
                    : r.usesLeft === 0 ? ["مُستنفد", "bg-gold/20 text-accent-foreground"]
                    : r.first_used_at ? ["مُستخدم", "bg-brand/10 text-brand"]
                    : ["جديد", "bg-success/15 text-success"];
                  return (
                    <tr key={r.id} className="border-b border-line/60 last:border-0">
                      <td className="py-2.5">
                        <button dir="ltr" onClick={() => copy(r.code)} className="inline-flex items-center gap-1.5 font-mono font-bold hover:text-brand">
                          {copied === r.code ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}{r.code}
                        </button>
                      </td>
                      <td className="text-muted-foreground">{r.label ?? "—"}</td>
                      <td className="tabular-nums">{r.uses.toLocaleString("ar-EG")} / {r.max_uses.toLocaleString("ar-EG")}</td>
                      <td className="tabular-nums">
                        {r.daysLeft.toLocaleString("ar-EG")} {!r.first_used_at && <span className="text-xs text-muted-foreground">(تبدأ عند التفعيل)</span>}
                      </td>
                      <td><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${state[1]}`}>{state[0]}</span></td>
                      <td className="whitespace-nowrap text-end">
                        <button onClick={() => act.mutate({ id: r.id, action: "toggle" })} aria-label={r.active ? "إيقاف" : "تفعيل"}
                          className="rounded-full p-2 text-muted-foreground hover:bg-muted"><Power className="size-4" /></button>
                        <button onClick={() => confirm("حذف هذا الكود نهائياً؟") && act.mutate({ id: r.id, action: "delete" })} aria-label="حذف"
                          className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SettingsPanel() {
  const get = useServerFn(adminGetSettings);
  const save = useServerFn(adminSaveOpenAIKey);
  const qc = useQueryClient();
  const s = useQuery({ queryKey: ["admin-settings"], queryFn: () => get() });
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const m = useMutation({
    mutationFn: () => save({ data: { key } }),
    onSuccess: (r) => {
      if (r.ok) { setKey(""); setMsg({ ok: true, text: "تم حفظ المفتاح والتحقق منه." }); qc.invalidateQueries({ queryKey: ["admin-settings"] }); }
      else setMsg({ ok: false, text: r.error });
    },
    onError: (e) => setMsg({ ok: false, text: (e as Error).message }),
  });
  return (
    <section className="max-w-2xl rounded-3xl border border-line bg-card p-6 shadow-card">
      <h2 className="flex items-center gap-2 font-display text-lg font-extrabold"><Settings2 className="size-5 text-brand" /> مفتاح OpenAI</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        يُستخدم هذا المفتاح لتشغيل التفريغ الصوتي (Whisper) والتشكيل والتدقيق (GPT-4o) لكل المستخدمين المفعّلين. يُحفظ على الخادم ولا يظهر للمستخدمين.
      </p>
      <div className="mt-4 rounded-2xl bg-muted p-3 text-sm">
        {s.isLoading ? "…" : s.data?.hasKey
          ? <>المفتاح الحالي: <span dir="ltr" className="font-mono font-bold">{s.data.masked}</span></>
          : <span className="font-bold text-destructive">لم يُضبط أي مفتاح بعد</span>}
      </div>
      <label htmlFor="okey" className="mt-5 block text-sm font-bold">مفتاح جديد</label>
      <input id="okey" type="password" dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-..."
        autoComplete="off"
        className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 font-mono outline-none focus:ring-2 focus:ring-ring" />
      {msg && <p className={`mt-2 text-sm font-bold ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>}
      <button onClick={() => { setMsg(null); m.mutate(); }} disabled={m.isPending || key.trim().length < 20}
        className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 font-display font-extrabold text-primary-foreground shadow-brand disabled:opacity-50">
        {m.isPending && <Loader2 className="size-4 animate-spin" />} حفظ المفتاح
      </button>
    </section>
  );
}
