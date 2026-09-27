import { Link, useRouterState } from "@tanstack/react-router";
import { AudioLines, PenLine, FileDown } from "lucide-react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SettingsProvider, useSettings } from "@/lib/settings";
import { SettingsDialog } from "@/components/settings-dialog";

const tabs = [
  { to: "/", label: "تفريغ الصوتيات", icon: AudioLines },
  { to: "/review", label: "التدقيق والتشكيل", icon: PenLine },
  { to: "/export", label: "تنسيق وتصدير", icon: FileDown },
] as const;

function useIsActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand shadow-brand">
        <span className="font-display text-xl font-bold text-gold">ص</span>
      </div>
      <div>
        <p className="font-display text-xl font-bold leading-none text-foreground">صوتُك</p>
        <p className="mt-1 text-[11px] text-muted-foreground">استوديو التفريغ الذكي</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <Shell>{children}</Shell>
    </SettingsProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const isActive = useIsActive();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { settings } = useSettings();
  const reduce = settings.reduceMotion;

  return (
    <div className="flex min-h-screen w-full bg-surface font-body text-foreground">
      {/* Desktop sidebar (right side in RTL) */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-e border-line bg-card px-5 py-6 lg:flex">
        <BrandMark />

        <nav className="mt-10 flex flex-col gap-2">
          {tabs.map((tab) => {
            const active = isActive(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={
                  "relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors " +
                  (active ? "font-bold text-primary-foreground" : "font-medium text-muted-foreground hover:bg-muted")
                }
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-2xl bg-brand shadow-brand"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <tab.icon className="relative size-5 shrink-0" />
                <span className="relative">{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-line pt-4">
          <SettingsDialog />
        </div>

        <div className="mt-auto rounded-2xl border border-line bg-surface p-4">
          <p className="flex items-center gap-2 font-display text-xs font-bold text-foreground">
            <span className="inline-block size-2 rounded-full bg-gold animate-pulse" />
            نسخة تجريبية
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            تستخدم حصة مجانية من التفريغ. ترقّي حسابك لمزيد من الساعات.
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-3 px-4 pb-3 pt-5 sm:px-5 lg:hidden">
          <BrandMark />
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-accent/25 px-3 py-1.5 text-[11px] font-bold text-accent-foreground min-[380px]:inline">
              نسخة تجريبية
            </span>
            <SettingsDialog compact />
          </div>
        </header>

        {/* Mobile tab pills */}
        <nav className="sticky top-0 z-30 bg-surface/90 px-4 pb-3 pt-1 backdrop-blur sm:px-5 lg:hidden">
          <div className="flex items-center gap-2 rounded-3xl border border-line bg-card p-1.5 shadow-card">
            {tabs.map((tab) => {
              const active = isActive(tab.to);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={
                    "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-3 text-center transition-colors " +
                    (active ? "font-bold text-primary-foreground" : "font-medium text-muted-foreground")
                  }
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active-mobile"
                      className="absolute inset-0 rounded-2xl bg-brand shadow-brand"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <tab.icon className="relative size-4" />
                  <span className="relative text-[11px] leading-tight">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="flex-1 overflow-x-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 1 } : { opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: reduce ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
