import { createFileRoute } from "@tanstack/react-router";
import { type Quote } from "@/lib/mock-data";
import { useRunsData } from "@/hooks/use-runs-data";
import { HashChip } from "@/components/ui-bits";
import { cn } from "@/lib/utils";
import { Phone, PhoneCall, PhoneOff, Radio } from "lucide-react";

export const Route = createFileRoute("/calls")({
  component: LiveCallsPage,
  head: () => ({
    meta: [
      { title: "Live Calls · The Negotiator" },
      {
        name: "description",
        content: "Real-time provider calls with live transcripts and event feed.",
      },
    ],
  }),
});

function StatusPill({ status }: { status: Quote["callStatus"] }) {
  const cfg = {
    QUEUED: {
      label: "QUEUED",
      cls: "text-muted-foreground border-border bg-muted/40",
      icon: Phone,
    },
    ON_CALL: {
      label: "ON CALL",
      cls: "text-info border-info/40 bg-info/10",
      icon: PhoneCall,
      pulse: true,
    },
    COMPLETE: {
      label: "COMPLETE",
      cls: "text-success border-success/40 bg-success/10",
      icon: PhoneOff,
    },
  }[status];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] mono",
        cfg.cls,
      )}
    >
      {"pulse" in cfg && cfg.pulse ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-info" />
        </span>
      ) : (
        <Icon className="h-2.5 w-2.5" />
      )}
      {cfg.label}
    </span>
  );
}

function EventLine({ e }: { e: Quote["events"][number] }) {
  const kindCls = {
    LOG: "text-muted-foreground",
    TRIGGER: "text-warning",
    TACTIC: "text-primary",
  }[e.kind];
  return (
    <div className="flex items-start gap-2 py-1 border-t border-border/50 first:border-t-0">
      <span className="mono text-[10px] text-muted-foreground/60 w-9 shrink-0 pt-0.5">{e.t}</span>
      <span className={cn("mono text-[11px] leading-snug", kindCls)}>{e.text}</span>
    </div>
  );
}

function CallCard({ q }: { q: Quote }) {
  return (
    <article className="panel flex flex-col overflow-hidden">
      <header className="flex items-start justify-between gap-2 border-b border-border bg-panel-2/60 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{q.provider}</h3>
          <p className="text-[11px] text-muted-foreground truncate">{q.location}</p>
        </div>
        <StatusPill status={q.callStatus} />
      </header>

      <div className="px-4 pt-3">
        <HashChip hash={q.jobSpecHash} />
      </div>

      {/* Transcript */}
      <div className="mx-4 mt-3 flex-1 rounded-md border border-border bg-background/40">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Live transcript
          </span>
          <Radio className="h-3 w-3 text-primary" />
        </div>
        <div className="max-h-64 overflow-y-auto p-3 space-y-2 text-[12px] leading-relaxed">
          {q.transcriptTurns.map((t) => (
            <div key={t.turnId} className="flex gap-2">
              <span className="mono text-[9px] text-muted-foreground/60 shrink-0 w-9 pt-0.5">
                {t.timestamp}
              </span>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-[9px] font-semibold tracking-[0.12em] mono",
                    t.speaker === "AGENT" ? "text-primary" : "text-info",
                  )}
                >
                  {t.speaker}
                </div>
                <p className="text-foreground/90">{t.text}</p>
              </div>
            </div>
          ))}
          {q.callStatus === "ON_CALL" && (
            <div className="flex items-center gap-1 pl-11 text-[10px] mono text-muted-foreground">
              <span className="h-1 w-1 rounded-full bg-info animate-pulse" />
              <span className="h-1 w-1 rounded-full bg-info animate-pulse [animation-delay:150ms]" />
              <span className="h-1 w-1 rounded-full bg-info animate-pulse [animation-delay:300ms]" />
              <span className="ml-2">shop is speaking…</span>
            </div>
          )}
        </div>
      </div>

      {/* Events */}
      <div className="mx-4 my-3 rounded-md border border-border bg-background/40">
        <div className="border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Event feed
        </div>
        <div className="px-3 py-2 max-h-48 overflow-y-auto">
          {q.events.map((e) => (
            <EventLine key={e.id} e={e} />
          ))}
        </div>
      </div>
    </article>
  );
}

function LiveCallsPage() {
  const { calls: CALLS } = useRunsData();
  const completed = CALLS.filter((call) => call.callStatus === "COMPLETE").length;
  const active = CALLS.filter((call) => call.callStatus === "ON_CALL").length;
  return (
    <div className="px-6 py-8 md:px-10 md:py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <span className="h-1 w-6 bg-primary" /> Step 02 · Live Calls
        </div>
        <div className="mt-3 flex items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Live calls</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Every completed, callback, declined, dropped, and active interaction is retained even
              when the provider does not give a quote.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-4 mono text-[11px] text-muted-foreground">
            <span>
              <span className="text-success">●</span> {completed} complete
            </span>
            <span>
              <span className="text-info">●</span> {active} on call
            </span>
            <span>
              <span className="text-muted-foreground">●</span> {Math.max(0, 1 - CALLS.length)}{" "}
              remaining
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {CALLS.map((q) => (
          <CallCard key={q.quoteId} q={q} />
        ))}
      </div>
      {CALLS.length === 0 && (
        <div className="panel p-8 text-sm text-muted-foreground">
          No phone interaction has been recorded for this negotiation yet.
        </div>
      )}
    </div>
  );
}
