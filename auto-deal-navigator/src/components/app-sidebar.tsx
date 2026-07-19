import { Link, useRouterState } from "@tanstack/react-router";
import { FileCheck2, PhoneCall, Scale, Handshake, Trophy, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Your Job", icon: FileCheck2, step: "01" },
  { to: "/calls", label: "Live Calls", icon: PhoneCall, step: "02" },
  { to: "/compare", label: "Compare Quotes", icon: Scale, step: "03" },
  { to: "/negotiation", label: "Negotiation", icon: Handshake, step: "04" },
  { to: "/recommendation", label: "Recommendation", icon: Trophy, step: "05" },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[8px_0_32px_-28px_rgba(9,47,95,0.5)]">
        <div className="px-5 pt-6 pb-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Radio className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-warning" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-foreground">The Negotiator</div>
              <div className="text-[11px] text-muted-foreground">AI-assisted quote desk</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Run · rc_9f2ac81e
          </div>
          {nav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm transition-all",
                  active
                    ? "bg-sidebar-accent text-foreground shadow-[inset_3px_0_0_var(--color-primary)]"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "mono text-[10px] w-6 tabular-nums",
                    active ? "text-primary" : "text-muted-foreground/70",
                  )}
                >
                  {item.step}
                </span>
                <Icon className={cn("h-4 w-4", active && "text-primary")} />
                <span className="font-medium">{item.label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-warning" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-sidebar-border text-[11px] text-muted-foreground space-y-1">
          <div className="flex items-center justify-between">
            <span>Policy engine</span>
            <span className="mono text-success">ONLINE</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Provider market</span>
            <span className="mono text-warning">SIMULATED</span>
          </div>
        </div>
      </aside>
      <nav
        className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 overflow-hidden rounded-xl border border-border bg-panel/95 p-1.5 shadow-[0_16px_44px_rgba(9,47,95,0.24)] backdrop-blur md:hidden"
        aria-label="Workflow navigation"
      >
        {nav.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={`${item.step} ${item.label}`}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[9px] font-semibold transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
