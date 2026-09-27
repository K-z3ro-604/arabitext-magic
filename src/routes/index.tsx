import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  FileAudio2,
  FileVideo2,
  X,
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  Clock,
  AudioLines,
  PenLine,
  FileDown,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "تفريغ الصوتيات — صوتُك" },
      { name: "description", content: "اسحب ملف الصوت أو الفيديو وحوّله إلى نص عربي منسّق بضغطة واحدة." },
      { property: "og:title", content: "تفريغ الصوتيات — صوتُك" },
      { property: "og:description", content: "حوّل صوتك إلى نصٍ منسّق بضغطة واحدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

interface PickedFile {
  name: string;
  size: number;
  isVideo: boolean;
}

const DUMMY_TRANSCRIPT = `في بداية الحلقة، استقبلنا سؤالاً من أحد المستمعين حول أفضل الطرق لبناء قاعدة بيانات مستخدمين آمنة. بدأنا الحديث عن أهمية التشفير، ثم انتقلنا إلى شرح عملي لطريقة التحقق من البريد الإلكتروني عبر الرسائل القصيرة.

وفي الجزء التالي، فصّلنا تجربة المستخدمين على الجوال وكيف نوازن بين السرعة وضغط الصور، مع أمثلة عملية من مشاريع حقيقية واجهناها خلال العام الماضي.`;

const PROGRESS_STAGES = [
  "تحليل الموجة الصوتية…",
  "استخراج الكلمات…",
  "ترتيب الفقرات وتنسيق النص…",
];

function formatSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
  return `${mb.toLocaleString("ar-EG", { maximumFractionDigits: 1 })} م.ب`;
}

function formatArabicNumber(n: number) {
  return n.toLocaleString("ar-EG");
}

function Index() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => stopTimer, [stopTimer]);

  const acceptFile = (f: File) => {
    setFile({
      name: f.name,
      size: f.size,
      isVideo: f.type.startsWith("video"),
    });
    setTranscript("");
    setProgress(0);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) acceptFile(f);
  };

  const startTranscription = () => {
    if (!file || transcribing) return;
    setTranscript("");
    setProgress(0);
    setTranscribing(true);
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 2 + Math.random() * 4);
        if (next >= 100) {
          stopTimer();
          setTranscribing(false);
          setTranscript(DUMMY_TRANSCRIPT);
        }
        return next;
      });
    }, 80);
  };

  const stage = PROGRESS_STAGES[Math.min(2, Math.floor(progress / 34))];
  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  const copyTranscript = async () => {
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-12 lg:px-10 lg:pt-10">
      {/* Hero */}
      <section className="mt-1 lg:mt-0">
        <h1 className="font-display text-[27px] font-extrabold leading-[1.15] text-foreground md:text-4xl">
          حوّل <span className="text-brand">صوتك</span> إلى
          <br />
          نصٍ منسّق
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground md:text-sm">
          اسحب ملفك أو اختره، ثم ابدأ التفريغ بضغطة واحدة.
        </p>
      </section>

      {/* Drop zone */}
      <section className="mt-4 md:mt-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          className={
            "cursor-pointer rounded-4xl border-2 border-dashed bg-card p-5 text-center transition-colors md:p-8 " +
            (dragActive
              ? "border-brand bg-brand/5"
              : "border-brand/40 hover:border-brand/70")
          }
        >
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) acceptFile(f);
              e.target.value = "";
            }}
          />
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-brand/10">
            <Upload className="size-8 text-brand" />
          </div>
          <p className="mt-3 font-display text-[15px] font-bold text-foreground md:text-base">
            اسحب ملف الصوت أو الفيديو هنا
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground md:text-xs">
            MP3 · WAV · MP4 — حتى ٥٠٠ م.ب
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="mt-4 w-full rounded-2xl bg-accent py-3.5 font-display text-sm font-bold text-accent-foreground shadow-gold transition-colors hover:bg-accent/90 md:w-auto md:px-10"
          >
            اختر ملفاً من الجهاز
          </button>
        </div>

        {/* Selected file row */}
        {file && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              {file.isVideo ? <FileVideo2 className="size-5" /> : <FileAudio2 className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{file.name}</p>
              <p className="text-[11px] text-muted-foreground">{formatSize(file.size)}</p>
            </div>
            <button
              type="button"
              aria-label="إزالة الملف"
              onClick={() => {
                setFile(null);
                setProgress(0);
                setTranscript("");
              }}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
      </section>

      {/* Start button */}
      <section className="mt-4 md:mt-6">
        <button
          type="button"
          onClick={startTranscription}
          disabled={!file || transcribing}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-4 font-display text-base font-extrabold text-background shadow-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {transcribing ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              جارٍ التفريغ…
            </>
          ) : (
            <>
              ابدأ التفريغ
              <ArrowLeft className="size-5" strokeWidth={2.2} />
            </>
          )}
        </button>

        {/* Progress */}
        {(transcribing || progress > 0) && (
          <div className="mt-4 rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 animate-pulse rounded-full bg-brand" />
                {transcribing ? "جارٍ المعالجة" : "اكتمل التفريغ"}
              </span>
              <span className="text-brand">{formatArabicNumber(Math.round(progress))}٪</span>
            </div>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-gradient-to-l from-brand to-brand-2 transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {progress >= 100 ? "تم إنجاز التفريغ بنجاح" : stage}
            </p>
          </div>
        )}
      </section>

      {/* Transcript */}
      <section className="mt-4 md:mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-foreground md:text-lg">
            <Sparkles className="size-4 text-brand" />
            النص المُفرَّغ
          </h2>
          <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold text-brand">
            عربي فصحى
          </span>
        </div>

        <div className="rounded-3xl border border-line bg-card p-4 md:p-5">
          {transcript ? (
            <>
              <textarea
                dir="rtl"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                spellCheck={false}
                className="min-h-[220px] w-full resize-y bg-transparent text-sm leading-[2] text-foreground outline-none md:text-[15px]"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-[11px] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-foreground/30" />
                {file && (
                  <>
                    <span>الملف:</span>
                    <span className="font-bold text-foreground">{file.name}</span>
                  </>
                )}
                <span className="tabular-nums">{formatArabicNumber(wordCount)} كلمة</span>
                <button
                  type="button"
                  onClick={copyTranscript}
                  className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 font-bold text-foreground transition-colors hover:bg-accent/30"
                >
                  {copied ? <Check className="size-3.5 text-brand" /> : <Copy className="size-3.5" />}
                  {copied ? "تم النسخ" : "نسخ النص"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-muted">
                <AudioLines className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-bold text-foreground">لم يُفرَّغ أي نص بعد</p>
              <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                اختر ملفاً صوتياً أو مرئياً بالأعلى، ثم اضغط «ابدأ التفريغ» ليظهر النص هنا.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Upcoming tabs hint (mobile only — desktop shows them in the sidebar) */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:hidden">
        {[
          { icon: PenLine, label: "التدقيق والتشكيل", to: "/review" },
          { icon: FileDown, label: "تنسيق وتصدير", to: "/export" },
        ].map((item) => (
          <a
            key={item.to}
            href={item.to}
            className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 text-sm font-bold text-foreground"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
              <item.icon className="size-4" />
            </span>
            {item.label}
          </a>
        ))}
      </section>
    </div>
  );
}
