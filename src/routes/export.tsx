import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, FileDown, Loader2, Type, Baseline, Maximize, AlignJustify, Frame, BookOpen } from "lucide-react";
import { BookFrame, FootnoteRule, HeadingOrnament, type BookFrameStyle } from "@/components/book-ornament";
import { loadDocument } from "@/lib/document";

export const Route = createFileRoute("/export")({
  head: () => ({
    meta: [
      { title: "تنسيق وتصدير — صوتُك" },
      { name: "description", content: "نسّق النص النهائي كصفحة كتاب علمي مزخرفة مع معاينة A4 حيّة وصدّره إلى Word أو PDF." },
      { property: "og:title", content: "تنسيق وتصدير — صوتُك" },
      { property: "og:description", content: "نسّق نصك ككتاب علمي وصدّره إلى Word أو PDF بضغطة واحدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExportPage,
});

const SAMPLE_TEXT = `إنَّ الكتابةَ الصحيحةَ مهمةٌ جدًّا في حياتنا اليومية، فهي الجسر الذي تعبر عليه الأفكار من عقل إلى آخر، وبها تُحفظ المعارف وتنتقل عبر الأجيال (١).

وقد عُني العلماء قديمًا بضبط النصوص وتحريرها، فوضعوا لذلك قواعد دقيقة في الرواية والنسخ والمقابلة، حتى صار علم التحقيق فنًّا قائمًا بذاته.

[١] انظر: مقدمة ابن خلدون، فصل في صناعة الخط والكتابة.`;

const FOOTNOTE_RE = /^\s*[[(]\s*[0-9٠-٩]+\s*[\])]\s*/;

function parseDocument(text: string) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return {
    paragraphs: lines.filter((l) => !FOOTNOTE_RE.test(l)),
    footnotes: lines.filter((l) => FOOTNOTE_RE.test(l)),
  };
}

const FONTS = [
  { label: "أميري (Amiri)", value: "Amiri" },
  { label: "شهرزاد (Scheherazade New)", value: "Scheherazade New" },
  { label: "نسخ (Noto Naskh)", value: "Noto Naskh Arabic" },
  { label: "القاهرة (Cairo)", value: "Cairo" },
  { label: "تجوّل (Tajawal)", value: "Tajawal" },
];

const FRAMES: Array<{ label: string; value: BookFrameStyle }> = [
  { label: "إطار بسيط", value: "simple" },
  { label: "إسلامي كلاسيكي", value: "classic" },
  { label: "زهري ملكي", value: "royal" },
  { label: "علمي مبسّط", value: "scientific" },
];

const A4_W = 794; // px @96dpi
const A4_H = 1123; // px @96dpi
const MM = 3.7795; // px per mm
const PAGE_PX_TO_PT = 0.75;

function pageFits(page: HTMLElement) {
  return page.scrollHeight <= page.clientHeight + 1;
}

function buildPdfPages(template: HTMLElement, holder: HTMLElement) {
  const sourceHeader = template.querySelector<HTMLElement>("[data-book-header]");
  const sourceParagraphs = Array.from(template.querySelectorAll<HTMLElement>("[data-book-paragraph]"));
  const sourceFootnotes = template.querySelector<HTMLElement>("[data-book-footnotes]");
  const pages: HTMLElement[] = [];

  const createPage = () => {
    const page = template.cloneNode(true) as HTMLElement;
    page.removeAttribute("id");
    page.classList.add("pdf-export-page");
    page.style.width = "210mm";
    page.style.height = "297mm";
    page.style.minHeight = "297mm";
    page.style.overflow = "hidden";
    page.style.breakAfter = "page";
    page.style.pageBreakAfter = "always";
    page.querySelector<HTMLElement>("[data-book-body]")?.replaceChildren();
    page.querySelector<HTMLElement>("[data-book-footnotes]")?.remove();
    const number = page.querySelector<HTMLElement>("[data-book-page-number]");
    if (number) number.textContent = `﴿ ${(pages.length + 1).toLocaleString("ar-EG")} ﴾`;
    holder.appendChild(page);
    pages.push(page);
    return page;
  };

  let page = createPage();
  const initialBody = page.querySelector<HTMLElement>("[data-book-body]");
  if (!initialBody) return pages;
  let body: HTMLElement = initialBody;
  if (sourceHeader) body.appendChild(sourceHeader.cloneNode(true));

  const moveToNewPage = () => {
    page = createPage();
    const nextBody = page.querySelector<HTMLElement>("[data-book-body]");
    if (!nextBody) throw new Error("تعذّر إنشاء صفحة PDF");
    body = nextBody;
  };

  sourceParagraphs.forEach((sourceParagraph) => {
    let remaining = sourceParagraph.textContent?.trim().split(/\s+/).filter(Boolean) ?? [];
    let continuation = false;

    while (remaining.length > 0) {
      const full = sourceParagraph.cloneNode(true) as HTMLElement;
      full.textContent = remaining.join(" ");
      if (continuation) full.style.textIndent = "0";
      body.appendChild(full);
      if (pageFits(page)) break;
      full.remove();

      let low = 1;
      let high = remaining.length;
      let best = 0;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = sourceParagraph.cloneNode(true) as HTMLElement;
        candidate.textContent = remaining.slice(0, middle).join(" ");
        candidate.style.marginBottom = "0";
        if (continuation) candidate.style.textIndent = "0";
        body.appendChild(candidate);
        const fits = pageFits(page);
        candidate.remove();
        if (fits) {
          best = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }

      if (best > 0) {
        const fragment = sourceParagraph.cloneNode(true) as HTMLElement;
        fragment.textContent = remaining.slice(0, best).join(" ");
        fragment.style.marginBottom = "0";
        if (continuation) fragment.style.textIndent = "0";
        body.appendChild(fragment);
        remaining = remaining.slice(best);
        continuation = true;
      }
      moveToNewPage();
      if (best === 0 && remaining.length === 1) {
        const finalWord = sourceParagraph.cloneNode(true) as HTMLElement;
        finalWord.textContent = remaining[0] ?? "";
        finalWord.style.textIndent = "0";
        body.appendChild(finalWord);
        remaining = [];
      }
    }
  });

  if (sourceFootnotes) {
    let footer = page.querySelector<HTMLElement>("[data-book-footer]");
    footer?.prepend(sourceFootnotes.cloneNode(true));
    if (!pageFits(page)) {
      footer?.querySelector<HTMLElement>("[data-book-footnotes]")?.remove();
      moveToNewPage();
      footer = page.querySelector<HTMLElement>("[data-book-footer]");
      footer?.prepend(sourceFootnotes.cloneNode(true));
    }
  }

  pages.at(-1)?.style.setProperty("break-after", "auto");
  pages.at(-1)?.style.setProperty("page-break-after", "auto");
  return pages;
}

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

function ExportPage() {
  const [font, setFont] = useState("Amiri");
  const [size, setSize] = useState(16); // pt
  const [margin, setMargin] = useState(25); // mm
  const [lineHeight, setLineHeight] = useState(1.8);
  const [frameStyle, setFrameStyle] = useState<BookFrameStyle>("classic");
  const [title, setTitle] = useState("رسالة في فن الكتابة");
  const [chapter, setChapter] = useState("الباب الأول: في فضل العلم");
  const [text, setText] = useState(SAMPLE_TEXT);
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);
  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadDocument();
    if (saved.trim()) setText(saved);
  }, []);

  const BOOK = useMemo(() => ({ title, chapter, ...parseDocument(text) }), [title, chapter, text]);
  const slugName = (ext: string) => `${(title || "كتاب").replace(/\s+/g, "-")}.${ext}`;
  const padding = Math.max(margin * MM, 72);

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
    let holder: HTMLDivElement | null = null;
    let restoreVars = () => {};
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await document.fonts.ready;
      holder = document.createElement("div");
      holder.style.cssText = "position:fixed;top:0;inset-inline-start:-10000px;width:210mm;background:#fff;";
      document.body.appendChild(holder);
      const pages = buildPdfPages(pageRef.current, holder);
      if (pages.length === 0) throw new Error("تعذّر تقسيم المستند إلى صفحات");
      // html2canvas can't parse oklch theme colors — use plain print colors
      pages.forEach((pdfPage) => {
        [pdfPage, ...Array.from(pdfPage.querySelectorAll<HTMLElement>("*"))].forEach((el) => {
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
        pdfPage.style.backgroundColor = "#ffffff";
      });
      restoreVars = flattenOklchVars();
      await html2pdf()
        .set({
          margin: 0,
          filename: slugName("pdf"),
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(holder)
        .save();
    } finally {
      holder?.remove();
      restoreVars();
      setBusy(null);
    }
  };

  const exportDocx = async () => {
    setBusy("docx");
    try {
      const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } = await import("docx");
      const twip = (mm: number) => Math.round(mm * 56.7);
      const line = Math.round(240 * lineHeight);
      const run = (text: string, pt: number, bold = false) =>
        new TextRun({ text, font, size: pt * 2, bold, rightToLeft: true });
      const border = { style: BorderStyle.DOUBLE, size: 12, color: "8A6A2F", space: 24 };
      const pageMargin = twip(Math.max(margin, 22));
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                size: { width: 11906, height: 16838 },
                margin: { top: pageMargin, bottom: pageMargin, left: pageMargin, right: pageMargin },
                borders: { pageBorderTop: border, pageBorderBottom: border, pageBorderLeft: border, pageBorderRight: border },
              },
            },
            children: [
              new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run(BOOK.title, size + 10, true)] }),
              new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "❁", color: "8A6A2F", size: 24 })] }),
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
              ...(BOOK.footnotes.length
                ? [
                    new Paragraph({
                      bidirectional: true,
                      spacing: { before: 400, after: 80 },
                      indent: { left: 6000 },
                      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "8A6A2F", space: 1 } },
                      children: [],
                    }),
                    ...BOOK.footnotes.map(
                      (f) => new Paragraph({ bidirectional: true, alignment: AlignmentType.BOTH, spacing: { after: 60 }, children: [run(f, Math.max(9, size - 4))] }),
                    ),
                  ]
                : []),
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
    <div className="export-workspace mx-auto w-full max-w-7xl px-5 pb-12 pt-2 lg:px-10 lg:pt-10">
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
          <Control icon={<BookOpen className="size-4 text-brand" />} label="عنوان الكتاب">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </Control>
          <Control icon={<BookOpen className="size-4 text-brand" />} label="عنوان الباب / الفصل">
            <input value={chapter} onChange={(e) => setChapter(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </Control>
          <Control icon={<AlignJustify className="size-4 text-brand" />} label="متن النص">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
              className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-sm leading-7 text-foreground outline-none focus:ring-2 focus:ring-ring" />
            <span className="text-[11px] leading-relaxed text-muted-foreground">
              للحواشي: ابدأ السطر برقم بين قوسين مثل [١] ليظهر أسفل الصفحة تحت الفاصل.
            </span>
          </Control>
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
          <Control icon={<Frame className="size-4 text-brand" />} label="نمط إطار الصفحة">
            <select
              value={frameStyle}
              onChange={(e) => setFrameStyle(e.target.value as BookFrameStyle)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {FRAMES.map((frame) => <option key={frame.value} value={frame.value}>{frame.label}</option>)}
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

        <section className="print-preview min-w-0 overflow-hidden rounded-3xl bg-muted p-4 md:p-8">
          <p className="mb-4 text-center text-xs font-bold text-muted-foreground">معاينة الطباعة · A4</p>
          <div ref={wrapRef} className="mx-auto w-full max-w-[794px]">
            <div style={{ height: A4_H * scale, overflow: "hidden" }}>
              <div style={{ width: A4_W, transform: `scale(${scale})`, transformOrigin: "top right" }}>
                <div
                  ref={pageRef}
                  dir="rtl"
                   className="a4-print-page bg-card text-card-foreground shadow-card"
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    width: A4_W,
                    minHeight: A4_H,
                    padding,
                    fontFamily: `'${font}', 'Amiri', serif`,
                    fontSize: pxSize,
                    lineHeight,
                    boxSizing: "border-box",
                  }}
                >
                  <BookFrame width={A4_W} height={A4_H} variant={frameStyle} />
                  <div data-book-body>
                    <div data-book-header>
                      <h1 style={{ fontSize: pxSize * 1.9, fontWeight: 700, textAlign: "center", lineHeight: 1.4, marginBottom: pxSize * 0.3 }}>
                        {BOOK.title}
                      </h1>
                      <div style={{ marginBottom: pxSize * 0.5 }}><HeadingOrnament /></div>
                      <h2 style={{ fontSize: pxSize * 1.25, fontWeight: 700, textAlign: "center", lineHeight: 1.5, marginBottom: pxSize * 1.2 }}>
                        {BOOK.chapter}
                      </h2>
                    </div>
                    {BOOK.paragraphs.map((p, i) => (
                      <p data-book-paragraph key={i} style={{ textAlign: "justify", textIndent: "1.5em", marginBottom: pxSize * 0.6 }}>{p}</p>
                    ))}
                  </div>
                  <div data-book-footer style={{ marginTop: "auto" }}>
                    {BOOK.footnotes.length > 0 && (
                      <div data-book-footnotes style={{ paddingTop: pxSize * 1.2 }}>
                        <FootnoteRule />
                        <div style={{ marginTop: pxSize * 0.4, fontSize: pxSize * 0.78, lineHeight: 1.7 }}>
                          {BOOK.footnotes.map((f, i) => (
                            <p key={i} style={{ textAlign: "justify", marginBottom: 2 }}>{f}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    <p data-book-page-number className="text-muted-foreground" style={{ textAlign: "center", marginTop: pxSize, fontSize: pxSize * 0.8 }}>﴿ ١ ﴾</p>
                  </div>
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
