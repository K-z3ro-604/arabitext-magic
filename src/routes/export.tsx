import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, FileDown, Loader2, Type, Baseline, Maximize, AlignJustify, Frame, BookOpen } from "lucide-react";
import { BookFrame, FootnoteRule, HeadingOrnament, TOP_ONLY_FRAME_STYLES, type BookFrameStyle } from "@/components/book-ornament";
import { loadDocument } from "@/lib/document";
import { useServerFn } from "@tanstack/react-start";
import { processArabicText } from "@/lib/ai.functions";

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

type LayoutStyle = "standard" | "badr";
type BookBlock = {
  kind: "body" | "matn" | "sharh";
  text: string;
  dividerBefore?: boolean;
};

function parseDocument(text: string, layoutStyle: LayoutStyle) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const footnotes = lines.filter((line) => FOOTNOTE_RE.test(line));
  const content = lines.filter((line) => !FOOTNOTE_RE.test(line)).join("\n");
  const blocks: BookBlock[] = [];

  const append = (value: string, kind: BookBlock["kind"], dividerBefore = false) => {
    value.split(/\n+/).map((line) => line.trim()).filter(Boolean).forEach((line, index) => {
      blocks.push({ kind, text: line, dividerBefore: dividerBefore && index === 0 });
    });
  };

  if (layoutStyle === "badr") {
    const taggedBlock = /\[(متن|شرح)\]([\s\S]*?)\[\/\1\]/g;
    let cursor = 0;
    let matched = false;
    let dividerPending = false;
    for (const match of content.matchAll(taggedBlock)) {
      matched = true;
      const index = match.index ?? cursor;
      append(content.slice(cursor, index), "body");
      const kind = match[1] === "متن" ? "matn" : "sharh";
      append(match[2] ?? "", kind, kind === "sharh" && dividerPending);
      dividerPending = kind === "matn";
      cursor = index + match[0].length;
    }
    if (matched) append(content.slice(cursor), "body");
    else append(content, "body");
  } else {
    append(content, "body");
  }

  return {
    blocks,
    paragraphs: blocks.map((block) => block.text),
    footnotes,
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
  { label: "ملاحظات دراسية مسطّرة", value: "study" },
  { label: "رأس محاضرة منظّم", value: "lecture" },
  { label: "تعليقات هامشية هادئة", value: "annotation" },
];

const A4_W = 794; // px @96dpi
const A4_H = 1123; // px @96dpi
const MM = 3.7795; // px per mm
const PAGE_PX_TO_PT = 0.75;

function pageFits(page: HTMLElement) {
  const body = page.querySelector<HTMLElement>("[data-book-body]");
  const footer = page.querySelector<HTMLElement>("[data-book-footer]");
  const bodyFits = !body || body.scrollHeight <= body.clientHeight + 1;
  const footerFits = !footer || footer.scrollHeight <= footer.clientHeight + 1;
  return bodyFits && footerFits && page.scrollHeight <= page.clientHeight + 1;
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

    const prepareContinuation = (element: HTMLElement) => {
      if (!continuation) return;
      element.style.textIndent = "0";
      if (sourceParagraph.dataset["dividerBefore"] === "true") {
        element.style.borderTop = "none";
        element.style.paddingTop = "0";
        element.style.marginTop = "0";
      }
    };

    while (remaining.length > 0) {
      const full = sourceParagraph.cloneNode(true) as HTMLElement;
      full.textContent = remaining.join(" ");
      prepareContinuation(full);
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
        prepareContinuation(candidate);
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
        prepareContinuation(fragment);
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

function ExportPage() {
  const [font, setFont] = useState("Amiri");
  const [size, setSize] = useState(16); // pt
  const [margin, setMargin] = useState(25); // mm
  const [lineHeight, setLineHeight] = useState(1.8);
  const [frameStyle, setFrameStyle] = useState<BookFrameStyle>("classic");
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>("standard");
  const [title, setTitle] = useState("رسالة في فن الكتابة");
  const [chapter, setChapter] = useState("الباب الأول: في فضل العلم");
  const [text, setText] = useState(SAMPLE_TEXT);
  const [noteMode, setNoteMode] = useState<"manual" | "ai">("manual");
  const [aiText, setAiText] = useState<{ source: string; result: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const processText = useServerFn(processArabicText);
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);
  const [scale, setScale] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const sheetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadDocument();
    if (saved.trim()) setText(saved);
  }, []);

  const generateAiNotes = async () => {
    if (!text.trim() || aiBusy) return;
    setAiBusy(true);
    setAiError("");
    try {
      const r = await processText({ data: { text, mode: "footnotes" } });
      setAiText({ source: text, result: r.text });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "تعذّر التخريج الآلي");
    } finally {
      setAiBusy(false);
    }
  };

  const aiReady = noteMode === "ai" && aiText?.source === text;
  const effectiveText = aiReady && aiText ? aiText.result : text;
  const BOOK = useMemo(() => ({ title, chapter, ...parseDocument(effectiveText, layoutStyle) }), [title, chapter, effectiveText, layoutStyle]);
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

  // Paginate the hidden template into distinct fixed A4 sheets for the preview & print
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      await document.fonts.ready;
      const template = pageRef.current;
      const holder = sheetsRef.current;
      if (cancelled || !template || !holder) return;
      holder.replaceChildren();
      const sheets = buildPdfPages(template, holder);
      sheets.forEach((sheet) => {
        sheet.classList.remove("pdf-export-page");
        sheet.classList.add("a4-sheet", "shadow-card");
        sheet.removeAttribute("aria-hidden");
      });
      setPageCount(Math.max(1, sheets.length));
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [BOOK, font, size, lineHeight, padding, frameStyle, layoutStyle]);

  const exportPdf = async () => {
    const template = pageRef.current;
    const holder = sheetsRef.current;
    if (!template || !holder) return;
    setBusy("pdf");
    try {
      await Promise.all([
        document.fonts.load(`400 ${pxSize}px "${font}"`),
        document.fonts.load(`700 ${pxSize}px "${font}"`),
      ]);
      await document.fonts.ready;

      // Rebuild after font metrics settle so native printing receives complete,
      // correctly paginated A4 sheets instead of a mobile-sized canvas capture.
      holder.replaceChildren();
      const pages = buildPdfPages(template, holder);
      if (pages.length === 0) throw new Error("تعذّر تقسيم المستند إلى صفحات");
      pages.forEach((sheet) => {
        sheet.classList.remove("pdf-export-page");
        sheet.classList.add("a4-sheet", "shadow-card");
        sheet.removeAttribute("aria-hidden");
      });
      setPageCount(pages.length);

      await Promise.all(
        Array.from(holder.querySelectorAll("img")).map((image) =>
          image.complete ? Promise.resolve() : image.decode().catch(() => undefined),
        ),
      );
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      document.documentElement.classList.add("native-pdf-print");
      const finishPrint = () => {
        document.documentElement.classList.remove("native-pdf-print");
        setBusy(null);
      };
      window.addEventListener("afterprint", finishPrint, { once: true });
      window.print();
      window.setTimeout(finishPrint, 60_000);
      return;
    } finally {
      if (!document.documentElement.classList.contains("native-pdf-print")) setBusy(null);
    }
  };

  const exportDocx = async () => {
    setBusy("docx");
    try {
      const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, Header, Table, TableRow, TableCell, WidthType } = await import("docx");
      const twip = (mm: number) => Math.round(mm * 56.7);
      const line = Math.round(240 * lineHeight);
      const run = (text: string, pt: number, bold = false) =>
        new TextRun({ text, font, size: pt * 2, bold, rightToLeft: true });
      const border = { style: BorderStyle.DOUBLE, size: 12, color: "8A6A2F", space: 24 };
      const topOnly = TOP_ONLY_FRAME_STYLES.has(frameStyle);
      const headerMarks: Record<"study" | "lecture" | "annotation", string> = {
        study: "◆  ─────────────  ◆",
        lecture: "◇  ━━━━━━━━━━━━━  ◇",
        annotation: "•   •   •",
      };
      const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
      const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
      const headRun = (t: string) => new TextRun({ text: t, font, size: Math.max(9, size - 3) * 2, bold: true, color: "8A6A2F", rightToLeft: true });
      const titleRow = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({ borders: noBorders, width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.LEFT, children: [headRun(BOOK.chapter)] })] }),
              new TableCell({ borders: noBorders, width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [headRun(BOOK.title)] })] }),
            ],
          }),
        ],
      });
      const topHeader = topOnly
        ? new Header({
            children: [
              titleRow,
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                border: { bottom: { style: frameStyle === "study" ? BorderStyle.DOUBLE : BorderStyle.SINGLE, size: frameStyle === "lecture" ? 12 : 6, color: "8A6A2F", space: 5 } },
                children: [new TextRun({ text: headerMarks[frameStyle as "study" | "lecture" | "annotation"], color: "8A6A2F", size: 18 })],
              }),
            ],
          })
        : undefined;
      const pageMargin = twip(Math.max(margin, 22));
      const bodyParagraphs = BOOK.blocks.map((block) =>
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.BOTH,
          indent: { firstLine: block.kind === "matn" ? 0 : 567 },
          spacing: {
            line,
            before: block.dividerBefore ? 240 : 0,
            after: block.kind === "matn" ? 220 : 160,
          },
          ...(block.dividerBefore
            ? { border: { top: { style: BorderStyle.SINGLE, size: 8, color: "8A6A2F", space: 8 } } }
            : {}),
          children: [run(block.text, block.kind === "matn" ? size + 2 : size, block.kind === "matn")],
        }),
      );
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                size: { width: 11906, height: 16838 },
                margin: { top: pageMargin, bottom: pageMargin, left: pageMargin, right: pageMargin },
                ...(topOnly ? {} : { borders: { pageBorderTop: border, pageBorderBottom: border, pageBorderLeft: border, pageBorderRight: border } }),
              },
            },
            ...(topHeader ? { headers: { default: topHeader } } : {}),
            children: [
              new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run(BOOK.title, size + 10, true)] }),
              new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "❁", color: "8A6A2F", size: 24 })] }),
              new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [run(BOOK.chapter, size + 3, true)] }),
              ...bodyParagraphs,
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
          </Control>
          <Control icon={<FileText className="size-4 text-brand" />} label="نظام الحواشي">
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {([["manual", "حواشي يدوية"], ["ai", "تخريج وتوثيق آلي"]] as const).map(([v, l]) => (
                <button key={v} role="radio" aria-checked={noteMode === v} onClick={() => setNoteMode(v)}
                  className={`rounded-xl border px-2 py-2 text-xs font-bold transition ${noteMode === v ? "border-brand bg-brand text-primary-foreground" : "border-line bg-surface text-foreground hover:bg-muted"}`}>
                  {l}
                </button>
              ))}
            </div>
            {noteMode === "manual" ? (
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                ابدأ السطر برقم بين قوسين مثل [١] ليظهر أسفل الصفحة تحت الفاصل.
              </span>
            ) : (
              <>
                <button onClick={generateAiNotes} disabled={aiBusy || !text.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-3 py-2.5 text-xs font-extrabold text-accent-foreground disabled:opacity-50">
                  {aiBusy ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
                  {aiReady ? "إعادة التخريج" : "خرّج الآيات والأحاديث والأقوال"}
                </button>
                <span className="text-[11px] leading-relaxed text-muted-foreground">
                  {aiReady
                    ? `تمت إضافة ${BOOK.footnotes.length.toLocaleString("ar-EG")} حاشية إلى المعاينة.`
                    : aiText ? "تغيّر النص؛ أعد التخريج لتحديث الحواشي." : "يضيف الذكاء الاصطناعي أرقام الحواشي ومصادرها أسفل الصفحة."}
                </span>
                {aiError && <span className="text-[11px] font-bold text-destructive">{aiError}</span>}
              </>
            )}
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
          <Control icon={<Frame className="size-4 text-brand" />} label="نمط الصفحة">
            <select
              value={frameStyle}
              onChange={(e) => setFrameStyle(e.target.value as BookFrameStyle)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {FRAMES.map((frame) => <option key={frame.value} value={frame.value}>{frame.label}</option>)}
            </select>
            {TOP_ONLY_FRAME_STYLES.has(frameStyle) && (
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                زخرفة علوية فقط، مع جوانب وأسفل خالية للكتابة والتعليقات.
              </span>
            )}
          </Control>
          <Control icon={<BookOpen className="size-4 text-brand" />} label="نمط المتن والشرح">
            <select
              value={layoutStyle}
              onChange={(event) => setLayoutStyle(event.target.value as LayoutStyle)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="standard">تنسيق النص المعتاد</option>
              <option value="badr">نمط المتن والشرح (البدر الطالع)</option>
            </select>
            {layoutStyle === "badr" && (
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                استخدم [متن]...[/متن] ثم [شرح]...[/شرح] لإظهار المتن بارزًا والشرح تحته.
              </span>
            )}
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
              طباعة / حفظ PDF
            </button>
          </div>
        </aside>

        <section className="print-preview min-w-0 overflow-hidden rounded-3xl bg-muted p-4 md:p-8">
          <p className="mb-4 text-center text-xs font-bold text-muted-foreground">
            معاينة الطباعة · A4 · {pageCount.toLocaleString("ar-EG")} {pageCount === 1 ? "صفحة" : "صفحات"}
          </p>
          <div ref={wrapRef} className="mx-auto w-full max-w-[794px]">
            <div className="a4-preview-scale" style={{ width: A4_W, zoom: scale }}>
              {/* Distinct paginated A4 sheets, generated from the hidden template below */}
              <div ref={sheetsRef} className="a4-sheets" style={{ display: "flex", flexDirection: "column", gap: 24 }} />
              <div className="a4-template-wrap" aria-hidden style={{ position: "absolute", left: -99999, top: 0, visibility: "hidden", pointerEvents: "none" }}>
              <div
                ref={pageRef}
                dir="rtl"
                className="bg-card text-card-foreground"
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  width: A4_W,
                  minHeight: A4_H,
                  overflow: "hidden",
                  padding,
                  fontFamily: `'${font}', 'Amiri', serif`,
                  fontSize: pxSize,
                  lineHeight,
                  boxSizing: "border-box",
                }}
              >
                <BookFrame width={A4_W} height={A4_H} variant={frameStyle} />
                {TOP_ONLY_FRAME_STYLES.has(frameStyle) && (
                  <div
                    data-book-running-header
                    style={{ position: "relative", display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: pxSize, fontSize: pxSize * 0.8, fontWeight: 700, lineHeight: 1.4, marginBottom: pxSize * 0.8, color: "#8a6a2f" }}
                  >
                    <span style={{ textAlign: "right" }}>{BOOK.title}</span>
                    <span style={{ textAlign: "left" }}>{BOOK.chapter}</span>
                  </div>
                )}
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
                  {BOOK.blocks.map((block, i) => (
                    <p
                      data-book-paragraph
                      data-divider-before={block.dividerBefore ? "true" : undefined}
                      key={`${block.kind}-${i}`}
                      style={{
                        textAlign: "justify",
                        textIndent: block.kind === "matn" ? 0 : "1.5em",
                        marginTop: block.dividerBefore ? pxSize * 0.8 : 0,
                        marginBottom: block.kind === "matn" ? pxSize * 0.8 : pxSize * 0.6,
                        paddingTop: block.dividerBefore ? pxSize * 0.75 : 0,
                        borderTop: block.dividerBefore ? "1.5px solid #8a6a2f" : "none",
                        fontSize: block.kind === "matn" ? pxSize * 1.12 : pxSize,
                        fontWeight: block.kind === "matn" ? 700 : 400,
                      }}
                    >
                      {block.text}
                    </p>
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
