import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FileText, FileDown, Loader2, Type, Baseline, Maximize, AlignJustify } from "lucide-react";

export const Route = createFileRoute("/export")({
  head: () => ({
    meta: [
      { title: "تنسيق وتصدير — صوتُك" },
      { name: "description", content: "نسّق النص النهائي ككتاب مع معاينة A4 حيّة وصدّره إلى Word أو PDF." },
      { property: "og:title", content: "تنسيق وتصدير — صوتُك" },
      { property: "og:description", content: "نسّق نصك ككتاب وصدّره إلى Word أو PDF بضغطة واحدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExportPage,
});

const BOOK = {
  title: "حديث الاستوديو",
  chapter: "الفصل الأول: بداية الحكاية",
  paragraphs: [
    "في بداية الحلقة، استقبلنا سؤالاً من أحد المستمعين حول أفضل الطرق لبناء قاعدة بيانات مستخدمين آمنة. بدأنا الحديث عن أهمية التشفير، ثم انتقلنا إلى شرح عملي لطريقة التحقق من البريد الإلكتروني عبر الرسائل القصيرة.",
    "وفي الجزء التالي، فصّلنا تجربة المستخدمين على الجوال وكيف نوازن بين السرعة وضغط الصور، مع أمثلة عملية من مشاريع حقيقية واجهناها خلال العام الماضي.",
    "إنَّ الكتابةَ الصحيحةَ مهمةٌ جدًّا في حياتنا اليومية، فهي الجسر الذي تعبر عليه الأفكار من عقل إلى آخر، وبها تُحفظ المعارف وتنتقل عبر الأجيال.",
    "وختاماً، نشكر كل من شاركنا بسؤاله أو تعليقه، ونعدكم بحلقات قادمة أكثر ثراءً وعمقاً، نناقش فيها قضايا التقنية بلغة عربية سليمة وأسلوب قريب من القلب.",
  ],
};

const FONTS = [
  { label: "أميري (Amiri)", value: "Amiri" },
  { label: "نسخ (Noto Naskh)", value: "Noto Naskh Arabic" },
  { label: "شهرزاد (Scheherazade)", value: "Scheherazade New" },
  { label: "القاهرة (Cairo)", value: "Cairo" },
  { label: "تجوّل (Tajawal)", value: "Tajawal" },
];

const A4_W = 794; // px @96dpi
const MM = 3.7795; // px per mm
const PAGE_PX_TO_PT = 0.75;

// html2canvas can't parse oklch(): temporarily replace theme variables with rgb equivalents
function flattenOklchVars() {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const changed: string[] = [];
  if (!ctx) return () => {};
  for (let i = 0; i < cs.length; i++) {
    const name = cs[i]!;
    if (!name.startsWith("--")) continue;
    const val = cs.getPropertyValue(name).trim();
    if (!/^oklch\(/.test(val)) continue;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = val;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    root.style.setProperty(name, `rgba(${r}, ${g}, ${b}, ${(a ?? 255) / 255})`);
    changed.push(name);
  }
  return () => changed.forEach((n) => root.style.removeProperty(n));
}

function slugName(ext: string) {
  return `${BOOK.title.replace(/\s+/g, "-")}.${ext}`;
}

function ExportPage() {
  const [font, setFont] = useState("Amiri");
  const [size, setSize] = useState(16); // pt
  const [margin, setMargin] = useState(25); // mm
  const [lineHeight, setLineHeight] = useState(1.8);
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);
  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setScale(Math.min(1, e.contentRect.width / A4_W));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const exportPdf = async () => {
    if (!pageRef.current) return;
    setBusy("pdf");
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await document.fonts.ready;
      const clone = pageRef.current.cloneNode(true) as HTMLElement;
      clone.style.minHeight = "auto";
      // html2canvas can't parse oklch theme colors — use plain print colors
      [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))].forEach((el) => {
        const muted = el.classList.contains("text-muted-foreground");
        const rule = el.classList.contains("bg-border");
        el.removeAttribute("class");
        el.style.color = muted ? "#8a8070" : "#1f1b24";
        el.style.backgroundColor = rule ? "#e6dccf" : "transparent";
        el.style.boxShadow = "none";
        el.style.borderColor = "transparent";
        el.style.outlineColor = "transparent";
        el.style.textDecorationColor = "currentColor";
        el.style.caretColor = "auto";
        el.style.columnRuleColor = "transparent";
      });
      clone.style.backgroundColor = "#ffffff";
      const holder = document.createElement("div");
      holder.style.cssText = `position:fixed;top:0;inset-inline-start:-10000px;width:${A4_W}px;`;
      holder.appendChild(clone);
      document.body.appendChild(holder);
      const restoreVars = flattenOklchVars();
      await html2pdf()
        .set({
          margin: 0,
          filename: slugName("pdf"),
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(clone)
        .save();
      holder.remove();
      restoreVars();
    } finally {
      setBusy(null);
    }
  };

  const exportDocx = async () => {
    setBusy("docx");
    try {
      const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import("docx");
      const twip = (mm: number) => Math.round(mm * 56.7);
      const line = Math.round(240 * lineHeight);
      const run = (text: string, pt: number, bold = false) =>
        new TextRun({ text, font, size: pt * 2, bold, rightToLeft: true });
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                size: { width: 11906, height: 16838 },
                margin: { top: twip(margin), bottom: twip(margin), left: twip(margin), right: twip(margin) },
              },
            },
            children: [
              new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [run(BOOK.title, size + 10, true)] }),
              new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [run(BOOK.chapter, size + 3, true)] }),
              ...BOOK.paragraphs.map(
                (p) =>
                  new Paragraph({
                    bidirectional: true,
                    alignment: AlignmentType.BOTH,
                    indent: { firstLine: 567 },
                    spacing: { line, after: 160 },
                    children: [run(p, size)],
                  }),
              ),
            ],
          },
        ],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = slugName("docx");
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  };

  const pxSize = size / PAGE_PX_TO_PT;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-12 pt-2 lg:px-10 lg:pt-10">
      <section className="mt-1 lg:mt-0">
        <h1 className="font-display text-[27px] font-extrabold leading-[1.15] text-foreground md:text-4xl">
          تنسيق <span className="text-brand">وتصدير</span>
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground md:text-sm">
          صمّم نصك ككتاب، شاهد المعاينة الحيّة، ثم صدّره بضغطة واحدة.
        </p>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[300px_1fr]">
        <aside className="flex flex-col gap-5 self-start rounded-3xl border border-line bg-card p-5 shadow-card">
          <Control icon={<Type className="size-4 text-brand" />} label="نوع الخط">
            <select
              value={font}
              onChange={(e) => setFont(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {FONTS.map((f) => (
                <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
              ))}
            </select>
          </Control>
          <Slider icon={<Baseline className="size-4 text-brand" />} label="حجم الخط" value={size} min={11} max={24} step={1} unit="نقطة" onChange={setSize} />
          <Slider icon={<Maximize className="size-4 text-brand" />} label="هوامش الصفحة" value={margin} min={10} max={40} step={1} unit="مم" onChange={setMargin} />
          <Slider icon={<AlignJustify className="size-4 text-brand" />} label="تباعد الأسطر" value={lineHeight} min={1.2} max={2.6} step={0.1} unit="×" onChange={setLineHeight} />

          <div className="mt-2 flex flex-col gap-3">
            <button
              onClick={exportDocx}
              disabled={!!busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3.5 font-display text-sm font-extrabold text-background shadow-ink transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {busy === "docx" ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />}
              تصدير كملف Word (DOCX)
            </button>
            <button
              onClick={exportPdf}
              disabled={!!busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3.5 font-display text-sm font-extrabold text-primary-foreground shadow-brand transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {busy === "pdf" ? <Loader2 className="size-5 animate-spin" /> : <FileDown className="size-5" />}
              تصدير كملف PDF
            </button>
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-3xl bg-muted p-4 md:p-8">
          <p className="mb-4 text-center text-xs font-bold text-muted-foreground">معاينة الطباعة · A4</p>
          <div ref={wrapRef} className="mx-auto w-full max-w-[794px]">
            <div style={{ height: 1123 * scale, overflow: "hidden" }}>
              <div style={{ width: A4_W, transform: `scale(${scale})`, transformOrigin: "top right" }}>
                <div
                  ref={pageRef}
                  dir="rtl"
                  className="bg-card text-card-foreground shadow-card"
                  style={{
                    width: A4_W,
                    minHeight: 1123,
                    padding: margin * MM,
                    fontFamily: `'${font}', serif`,
                    fontSize: pxSize,
                    lineHeight,
                    boxSizing: "border-box",
                  }}
                >
                  <h1 style={{ fontSize: pxSize * 1.9, fontWeight: 700, textAlign: "center", lineHeight: 1.4, marginBottom: pxSize * 0.4 }}>
                    {BOOK.title}
                  </h1>
                  <div className="mx-auto mb-6 h-px w-24 bg-border" />
                  <h2 style={{ fontSize: pxSize * 1.25, fontWeight: 700, textAlign: "center", lineHeight: 1.5, marginBottom: pxSize * 1.4 }}>
                    {BOOK.chapter}
                  </h2>
                  {BOOK.paragraphs.map((p, i) => (
                    <p key={i} style={{ textAlign: "justify", textIndent: "1.5em", marginBottom: pxSize * 0.6 }}>{p}</p>
                  ))}
                  <p className="mt-10 text-center text-muted-foreground" style={{ fontSize: pxSize * 0.8 }}>— ١ —</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Control({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center gap-2 font-display text-sm font-bold text-foreground">{icon}{label}</span>
      {children}
    </label>
  );
}

function Slider({ icon, label, value, min, max, step, unit, onChange }: {
  icon: React.ReactNode; label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <Control icon={icon} label={label}>
      <div className="flex items-center gap-3">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-brand"
        />
        <span className="min-w-[64px] rounded-lg bg-muted px-2 py-1 text-center text-xs font-bold text-foreground">
          {value.toLocaleString("ar-EG", { maximumFractionDigits: 1 })} {unit}
        </span>
      </div>
    </Control>
  );
}
