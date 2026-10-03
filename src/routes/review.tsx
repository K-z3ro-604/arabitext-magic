import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  SpellCheck2,
  Sparkles,
  Loader2,
  CheckCheck,
  Eye,
  Copy,
  Check,
  Eraser,
  ClipboardPaste,
  Baseline,
} from "lucide-react";
import { processArabicText } from "@/lib/ai.functions";
import { loadDocument, saveDocument, stripDiacritics } from "@/lib/document";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "التدقيق والتشكيل — صوتُك" },
      { name: "description", content: "دقّق النص نحوياً وإملائياً وأضف التشكيل مع إظهار التعديلات بالألوان." },
      { property: "og:title", content: "التدقيق والتشكيل — صوتُك" },
      { property: "og:description", content: "دقّق النص وأضف التشكيل مع إظهار التعديلات بالألوان." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewPage,
});

const SAMPLE = `ان الكتابه الصحيحه مهمه جدا في حياتنا اليوميه. ذهبت الى المكتبه لكي اشتري كتاب جديد عن اللغه العربيه، ولاكن لم اجد ما ابحث عنه.`;

type Token = { type: "same" | "del" | "add"; text: string };

// Split into words + separators, keeping punctuation attached to boundaries
function tokenize(s: string) {
  return s.split(/(\s+|[،.؛:!؟,?﴿﴾«»"])/).filter((t) => t !== "");
}

// Word-level LCS diff
function diff(a: string, b: string): Token[] {
  const x = tokenize(a);
  const y = tokenize(b);
  const n = x.length, m = y.length;
  if (n * m > 4_000_000) return [{ type: "add", text: b }];
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const at = (i: number, j: number) => dp[i]![j]!;
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i]![j] = x[i] === y[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
  const out: Token[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { out.push({ type: "same", text: x[i]! }); i++; j++; }
    else if (at(i + 1, j) >= at(i, j + 1)) out.push({ type: "del", text: x[i++]! });
    else out.push({ type: "add", text: y[j++]! });
  }
  while (i < n) out.push({ type: "del", text: x[i++]! });
  while (j < m) out.push({ type: "add", text: y[j++]! });
  return out;
}

type Mode = "grammar" | "full" | "endings" | "strip";

const LOADING_TEXT: Record<Mode, string> = {
  grammar: "جاري التدقيق…",
  full: "جاري التشكيل الكامل…",
  endings: "جاري تشكيل أواخر الكلمات…",
  strip: "جاري إزالة التشكيل…",
};

function ReviewPage() {
  const [input, setInputState] = useState(SAMPLE);
  const [result, setResult] = useState<{ original: string; corrected: string; mode: Mode } | null>(null);
  const [loading, setLoading] = useState<Mode | null>(null);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [copied, setCopied] = useState(false);
  const processText = useServerFn(processArabicText);

  useEffect(() => {
    const saved = loadDocument();
    if (saved) setInputState(saved);
  }, []);

  const setInput = (t: string) => { setInputState(t); saveDocument(t); };

  const tokens = useMemo(
    () => (result ? diff(result.original, result.corrected) : []),
    [result],
  );
  const changeCount = tokens.filter((t) => t.type === "add").length;

  const run = async (mode: Mode) => {
    // Cumulative: each tool builds on the latest processed text, not the raw input.
    const base = result && !accepted ? result.corrected : input;
    const original = result && !accepted ? result.original : input;
    if (!base.trim() || loading) return;
    setAccepted(false);
    setError("");
    if (mode === "strip") {
      setResult({ original, corrected: stripDiacritics(base), mode });
      return;
    }
    setLoading(mode);
    try {
      const r = await processText({ data: { text: base, mode } });
      setResult({ original, corrected: r.text, mode });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّرت المعالجة");
    } finally {
      setLoading(null);
    }
  };

  const applyToInput = () => {
    if (!result) return;
    setInput(result.corrected);
    setResult(null);
    setAccepted(false);
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.corrected);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tools: { mode: Mode; label: string; icon: typeof Sparkles; cls: string }[] = [
    { mode: "full", label: "تشكيل كامل", icon: Sparkles, cls: "bg-gold text-accent-foreground shadow-gold" },
    { mode: "endings", label: "تشكيل أواخر الكلمات", icon: Baseline, cls: "bg-card text-foreground border border-line" },
    { mode: "strip", label: "إزالة التشكيل", icon: Eraser, cls: "bg-card text-foreground border border-line" },
    { mode: "grammar", label: "تدقيق نحوي وإملائي", icon: SpellCheck2, cls: "bg-brand text-primary-foreground shadow-brand" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-12 pt-2 lg:px-10 lg:pt-10">
      <section className="mt-1 lg:mt-0">
        <h1 className="font-display text-[27px] font-extrabold leading-[1.15] text-foreground md:text-4xl">
          التدقيق <span className="text-brand">والتشكيل</span>
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground md:text-sm">
          الصق نصك على اليمين، ثم اختر أداة من الشريط لترى التعديلات ملوّنة على اليسار.
        </p>
      </section>

      <div role="toolbar" aria-label="أدوات التشكيل والتحكم" className="mt-6 flex flex-wrap items-center gap-2 rounded-3xl border border-line bg-surface p-2">
        <span className="px-2 font-display text-xs font-bold text-muted-foreground">أدوات التشكيل والتحكم</span>
        {tools.map((t) => (
          <button
            key={t.mode}
            onClick={() => run(t.mode)}
            disabled={!!loading || !input.trim()}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 font-display text-sm font-extrabold transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 ${t.cls}`}
          >
            {loading === t.mode ? <Loader2 className="size-4 animate-spin" /> : <t.icon className="size-4" />}
            {t.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Input — first child sits on the right in RTL */}
        <section className="flex flex-col rounded-3xl border border-line bg-card p-4 shadow-card md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-foreground">
              <ClipboardPaste className="size-4 text-brand" /> النص الأصلي
            </h2>
            <button
              onClick={() => { setInput(""); setResult(null); }}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              <Eraser className="size-3.5" /> مسح
            </button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="الصق النص هنا…"
            className="min-h-[340px] flex-1 resize-y rounded-2xl border border-line bg-surface p-4 text-[17px] leading-[2.1] text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </section>

        {/* Output */}
        <section className="flex flex-col rounded-3xl border border-line bg-card p-4 shadow-card md:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-foreground">
              <Eye className="size-4 text-brand" /> النتيجة
              {result && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                  {changeCount.toLocaleString("ar-EG")} تعديل
                </span>
              )}
            </h2>
            {result && (
              <div className="flex items-center gap-2">
                <button
                  role="switch"
                  aria-checked={accepted}
                  onClick={() => setAccepted((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    accepted ? "border-success bg-success/10 text-success" : "border-line text-foreground hover:bg-muted"
                  }`}
                >
                  <span className={`relative h-4 w-7 rounded-full transition ${accepted ? "bg-success" : "bg-border"}`}>
                    <span className={`absolute top-0.5 size-3 rounded-full bg-card transition-all ${accepted ? "start-3.5" : "start-0.5"}`} />
                  </span>
                  قبول كل التعديلات
                </button>
                <button onClick={copy} aria-label="نسخ" className="rounded-full p-2 text-muted-foreground hover:bg-muted">
                  {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                </button>
              </div>
            )}
          </div>

          <div className="min-h-[340px] flex-1 rounded-2xl border border-line bg-surface p-4 text-[17px] leading-[2.3] text-foreground">
            {loading ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-brand" />
                <p className="text-sm">{LOADING_TEXT[loading]}</p>
              </div>
            ) : !result ? (
              <div className="flex h-full min-h-[300px] items-center justify-center text-center text-sm text-muted-foreground">
                ستظهر التعديلات هنا بالألوان: المحذوف بالأحمر والمُضاف بالأخضر.
              </div>
            ) : accepted ? (
              <p className="whitespace-pre-wrap">{result.corrected}</p>
            ) : (
              <p className="whitespace-pre-wrap">
                {tokens.map((t, i) =>
                  t.type === "same" ? (
                    <span key={i}>{t.text}</span>
                  ) : t.type === "del" ? (
                    <del key={i} className="rounded bg-destructive/15 px-0.5 text-destructive decoration-2">
                      {t.text}
                    </del>
                  ) : (
                    <ins key={i} className="rounded bg-success/15 px-0.5 font-bold text-success no-underline">
                      {t.text}
                    </ins>
                  ),
                )}
              </p>
            )}
          </div>

          {result && !loading && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-destructive" /> محذوف</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-success" /> مُضاف / مُصحَّح</span>
              </div>
              <button
                onClick={applyToInput}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-bold text-background shadow-ink hover:-translate-y-0.5 transition"
              >
                <CheckCheck className="size-4" /> اعتماد النص في المحرر
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
