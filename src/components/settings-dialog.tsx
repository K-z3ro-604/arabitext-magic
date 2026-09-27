import { Settings2, Sun, Moon, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { READING_FONTS, useSettings } from "@/lib/settings";

export function SettingsDialog({ compact = false }: { compact?: boolean }) {
  const { settings, update, reset } = useSettings();

  return (
    <Dialog>
      <DialogTrigger asChild>
        {compact ? (
          <button
            aria-label="الإعدادات العامة"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-card text-foreground transition hover:bg-muted"
          >
            <Settings2 className="size-5" />
          </button>
        ) : (
          <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted">
            <Settings2 className="size-5 shrink-0" />
            الإعدادات العامة
          </button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto border-line bg-card sm:max-w-md [&>button]:end-4 [&>button]:start-auto">
        <DialogHeader className="text-start sm:text-start">
          <DialogTitle className="font-display text-2xl font-bold text-foreground">الإعدادات العامة</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            خصّص المظهر وخط القراءة للنصوص الطويلة.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-6">
          <div>
            <p className="mb-2 text-sm font-bold text-foreground">المظهر</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: "light", label: "فاتح", Icon: Sun },
                { v: "dark", label: "داكن", Icon: Moon },
              ] as const).map(({ v, label, Icon }) => (
                <button
                  key={v}
                  onClick={() => update({ theme: v })}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                    settings.theme === v
                      ? "border-brand bg-brand text-primary-foreground"
                      : "border-line text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-foreground">خط القراءة</p>
            <div className="grid grid-cols-2 gap-2">
              {READING_FONTS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => update({ readingFont: f.value })}
                  style={{ fontFamily: `'${f.value}'` }}
                  className={`rounded-xl border px-3 py-2 text-base transition ${
                    settings.readingFont === f.value
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-line text-foreground hover:bg-muted"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">حجم نص القراءة</p>
              <span className="rounded-lg bg-muted px-2 py-0.5 text-xs font-bold text-foreground">
                {settings.readingSize.toLocaleString("ar-EG")} بكسل
              </span>
            </div>
            <input
              type="range"
              min={14}
              max={26}
              value={settings.readingSize}
              onChange={(e) => update({ readingSize: Number(e.target.value) })}
              className="w-full accent-brand"
            />
            <p className="font-reading mt-3 rounded-xl border border-line bg-surface p-3 text-foreground">
              بسم الله نبدأ، والكلمة الطيبة كشجرة طيبة أصلها ثابت وفرعها في السماء.
            </p>
          </div>

          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-bold text-foreground">تقليل الحركة</span>
              <span className="block text-xs text-muted-foreground">إيقاف الانتقالات المتحركة بين التبويبات</span>
            </span>
            <Switch
              dir="ltr"
              checked={settings.reduceMotion}
              onCheckedChange={(v) => update({ reduceMotion: v })}
            />
          </label>

          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-muted-foreground transition hover:bg-muted"
          >
            <RotateCcw className="size-4" /> استعادة الافتراضي
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
