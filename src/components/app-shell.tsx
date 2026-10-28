import { Link, useRouterState } from "@tanstack/react-router";
import {
  Brain,
  CalendarDays,
  Layers,
  Menu,
  PiggyBank,
  Receipt,
  Target,
  Wallet,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "วันนี้", icon: CalendarDays },
  { to: "/context", label: "บริบท", icon: Layers },
  { to: "/finance", label: "การเงิน", icon: Wallet },
  { to: "/goals", label: "เป้าหมาย", icon: Target },
  { to: "/calendar", label: "ปฏิทิน", icon: CalendarDays },
  { to: "/accounts", label: "บัญชี", icon: PiggyBank },
  { to: "/quota", label: "AI Quota", icon: Brain },
] as const;

/** แท็บล่างเหลือ 5 หลัก (ตาม Guide) — บัญชี/AI Quota ไปอยู่ใน drawer */
const TABS = NAV.slice(0, 5);

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.to;
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted hover:bg-surface-2 hover:text-foreground",
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col md:flex-row">
      {/* เมนูข้าง (desktop) */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface px-4 py-8 md:flex">
        <img src="/secretary-logo.png" alt="คุณเลขา" className="h-12 w-auto object-contain" />
        <div className="mt-10">
          <NavLinks pathname={pathname} />
        </div>
      </aside>

      {/* Drawer (mobile) — hamburger ที่ header */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            aria-label="ปิดเมนู"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-surface px-4 py-6">
            <div className="flex items-center justify-between">
              <img src="/secretary-logo.png" alt="คุณเลขา" className="h-10 w-auto object-contain" />
              <button
                type="button"
                aria-label="ปิดเมนู"
                className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-8">
              <NavLinks pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-dvh flex-1 flex-col pb-24 md:pb-0">
        {/* header มือถือ: hamburger + logo + สรุปเงิน */}
        <header className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] md:hidden">
          <button
            type="button"
            aria-label="เปิดเมนู"
            className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img src="/secretary-logo.png" alt="คุณเลขา" className="h-9 w-auto object-contain" />
          </Link>
          <Link
            to="/accounts"
            aria-label="สรุปยอดเงินใช้ได้"
            className="flex h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-medium text-muted"
          >
            <Receipt className="size-4" strokeWidth={1.75} />
            บัญชี
          </Link>
        </header>
        <main className="flex-1 px-4 py-4 md:px-8 md:py-8">{children}</main>
      </div>

      {/* แถบล่างมือถือ — 5 แท็บ */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          {TABS.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-12 min-w-16 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2 : 1.6} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
