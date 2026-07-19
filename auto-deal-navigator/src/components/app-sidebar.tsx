import { Link, useRouterState } from "@tanstack/react-router";
import {
  FileCheck2,
  PhoneCall,
  Scale,
  Handshake,
  Trophy,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Job Spec", icon: FileCheck2, step: "01" },
  { to: "/calls", label: "Live Calls", icon: PhoneCall, step: "02" },
  { to: "/compare", label: "Compare Quotes", icon: Scale, step: "03" },
  { to: "/negotiation", label: "Negotiation", icon: Handshake, step: "04" },
  { to: "/recommendation", label: "Recommendation", icon: Trophy, step: "05" },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="px-5 pt-6 pb-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
            <Radio className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">The Negotiator</div>
            <div className="text-[11px] text-muted-foreground">
              AI voice · v0.4.1
            </div>
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
                "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-foreground"
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
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px] shadow-primary" />
              )}
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
  );
}
