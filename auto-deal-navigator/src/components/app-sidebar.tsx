import { Link, useRouterState } from "@tanstack/react-router";
import { FileCheck2, PhoneCall, Scale, Handshake, Trophy, Radio, ShieldCheck } from "lucide-react";
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
      <aside className="hidden md:flex sticky top-0 h-[calc(100vh-28px)] w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/95 text-sidebar-foreground backdrop-blur-xl">
        <div className="px-5 pt-6 pb-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/30 shadow-[0_0_32px_-10px_var(--color-primary)]">
              <Radio className="h-4.5 w-4.5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-primary shadow-[0_0_10px] shadow-primary" />
            </div>
            <div>
              <div className="text-[15px] font-semibold tracking-[-0.02em]">The Negotiator</div>
              <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Autonomous quote desk
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-lg border border-sidebar-border bg-white/70 p-3 shadow-sm">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>Active run</span>
              <span className="inline-flex items-center gap-1.5 text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_7px] shadow-success" />{" "}
                Live
              </span>
            </div>
            <div className="mt-2 mono text-[11px] text-foreground">rc_9f2ac81e</div>
            <div className="signal-bars mt-3 flex h-2 items-center gap-1" aria-hidden="true">
              <i className="h-px w-8 bg-primary" />
              <i className="h-px w-12 bg-primary/70" />
              <i className="h-px w-5 bg-info" />
              <i className="h-px flex-1 bg-primary/40" />
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1.5" aria-label="Negotiation run stages">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Run progress
          </div>
          {nav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-all duration-200",
                  active
                    ? "bg-sidebar-accent text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/.04)]"
                    : "text-muted-foreground hover:bg-sidebar-accent/55 hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-primary shadow-[0_0_8px] shadow-primary" />
                )}
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md border text-[9px] mono transition-colors",
                    active
                      ? "border-primary/35 bg-primary/10 text-primary"
                      : "border-sidebar-border bg-white text-muted-foreground/70",
                  )}
                >
                  {item.step}
                </span>
                <Icon className={cn("h-4 w-4 transition-colors", active && "text-primary")} />
                <span className="font-medium tracking-[-0.01em]">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="m-3 rounded-lg border border-sidebar-border bg-white/70 p-3.5 text-[11px] text-muted-foreground shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">Guardrail status</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Policy engine</span>
            <span className="mono text-[10px] text-success">ONLINE</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Provider market</span>
            <span className="mono text-[10px] text-warning">SIMULATED</span>
          </div>
        </div>
      </aside>

      <div className="md:hidden sticky top-0 z-40 border-b border-border bg-sidebar/95 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/30">
              <Radio className="h-3.5 w-3.5" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-sidebar bg-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">The Negotiator</div>
              <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                Run rc_9f2ac81e
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
          </span>
        </div>
        <nav
          className="flex overflow-x-auto border-t border-sidebar-border px-2 [scrollbar-width:none]"
          aria-label="Negotiation run stages"
        >
          {nav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex min-w-[74px] flex-1 flex-col items-center gap-1 px-2 py-2 text-[9px] font-medium text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label.replace("Compare Quotes", "Compare")}</span>
                {active && (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
