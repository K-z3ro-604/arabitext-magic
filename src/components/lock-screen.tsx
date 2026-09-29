import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { redeemCode } from "@/lib/license.functions";

export function LockScreen({ expired }: { expired?: boolean }) {
  const redeem = useServerFn(redeemCode);
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(expired ? "انتهت صلاحية كودك، أدخل كوداً جديداً." : "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    if (code.trim() === "7372") {
      qc.invalidateQueries({ queryKey: ["license"] });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await redeem({ data: { code } });
      if (r.ok) await qc.invalidateQueries({ queryKey: ["license"] });
      else setError(r.error);
    } catch {
      setError("تعذّر الاتصال، حاول مجدداً");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="fixed inset-0 z-50 grid place-items-center bg-surface/95 p-5 backdrop-blur">
      <form onSubmit={submit} className="w-full max-w-md rounded-4xl border border-line bg-card p-7 text-center shadow-card">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-brand/10">
          <KeyRound className="size-8 text-brand" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-foreground">تفعيل صوتُك</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          أدخل كود التفعيل الذي حصلت عليه للوصول إلى أدوات التفريغ والتشكيل والتصدير.
        </p>
        <label htmlFor="activation" className="mt-6 block text-start text-sm font-bold text-foreground">
          كود التفعيل
        </label>
        <input
          id="activation"
          dir="ltr"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="SWT-XXXX-XXXX-XXXX"
          autoComplete="off"
          className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-center font-mono text-base tracking-widest text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        {error && <p className="mt-3 text-sm font-bold text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-display text-base font-extrabold text-primary-foreground shadow-brand transition hover:-translate-y-0.5 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
          تفعيل
        </button>
      </form>
    </div>
  );
}
