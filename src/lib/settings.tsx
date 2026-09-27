import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface AppSettings {
  theme: "light" | "dark";
  readingFont: string;
  readingSize: number;
  reduceMotion: boolean;
}

export const READING_FONTS = [
  { label: "نسخ (Noto Naskh)", value: "Noto Naskh Arabic" },
  { label: "أميري (Amiri)", value: "Amiri" },
  { label: "شهرزاد (Scheherazade)", value: "Scheherazade New" },
  { label: "تجوّل (Tajawal)", value: "Tajawal" },
];

const DEFAULTS: AppSettings = {
  theme: "light",
  readingFont: "Noto Naskh Arabic",
  readingSize: 18,
  reduceMotion: false,
};

const KEY = "sawtuk-settings";

const Ctx = createContext<{
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
}>({ settings: DEFAULTS, update: () => {}, reset: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", settings.theme === "dark");
    root.style.setProperty("--font-reading", `"${settings.readingFont}", "Amiri", serif`);
    root.style.setProperty("--reading-size", `${settings.readingSize}px`);
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings]);

  return (
    <Ctx.Provider
      value={{
        settings,
        update: (patch) => setSettings((s) => ({ ...s, ...patch })),
        reset: () => setSettings(DEFAULTS),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useSettings = () => useContext(Ctx);
