import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, PiggyBank, Target, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "วันนี้", icon: CalendarDays },
  { to: "/finance", label: "การเงิน", icon: Wallet },
  { to: "/goals", label: "เป้าหมาย", icon: Target },
  { to: "/calendar", label: "ปฏิทิน", icon: CalendarDays },
  { to: "/accounts", label: "บัญชี", icon: PiggyBank },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface px-4 py-8 md:flex">
        <img src="/secretary-logo.png" alt="คุณเลขา" className="h-12 w-auto object-contain" />
        <nav className="mt-10 flex flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col pb-20 md:pb-0">
        <header className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] md:hidden">
          <img src="/secretary-logo.png" alt="คุณเลขา" className="h-10 w-auto object-contain" />
        </header>
        <main className="flex-1 px-4 py-4 md:px-8 md:py-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-lg justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          {NAV.map((item) => {
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
