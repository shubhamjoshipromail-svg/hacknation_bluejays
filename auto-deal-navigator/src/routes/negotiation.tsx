import { createFileRoute } from "@tanstack/react-router";
import { formatMoney } from "@/lib/mock-data";
import { useRunsData } from "@/hooks/use-runs-data";
import { HashChip } from "@/components/ui-bits";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Ban, TrendingDown, Sparkles } from "lucide-react";

export const Route = createFileRoute("/negotiation")({
  component: NegotiationPage,
  head: () => ({
    meta: [
      { title: "Negotiation · The Negotiator" },
      {
        name: "description",
        content: "Policy-audited negotiation timeline with verified savings.",
      },
    ],
  }),
});

function NegotiationPage() {
  const { quotes: QUOTES, policyDecisions: POLICY_DECISIONS } = useRunsData();
  const primary =
    QUOTES.find((q) => q.quoteId === "q_clearview") ??
    QUOTES.find((q) => q.revisedOfferMinor !== undefined) ??
    QUOTES[0];
  const savings = (primary.originalOfferMinor ?? 0) - (primary.revisedOfferMinor ?? 0);

  const timeline = [
    {
      kind: "OFFER" as const,
      t: "00:48",
      title: "Original offer",
      body: `${primary.provider} · all-in`,
      amount: primary.originalOfferMinor,
    },
    {
      kind: "POLICY" as const,
      t: "02:34",
      title: "VerifiedFact minted",
      body: "GlassGo Mobile · $585 all-in with calibration — sourced from transcript turn t2, provenance NHTSA-confirmed calibration line.",
    },
    {
      kind: "TACTIC" as const,
      t: "02:38",
      title: "[TACTIC] anchor_verified_quote",
      body: "Agent references competitor all-in and requests match on identical spec hash.",
    },
    {
      kind: "TACTIC" as const,
      t: "02:51",
      title: "[TACTIC] itemize_headroom",
      body: "Agent asks which line item has flex; shop confirms glass margin, not calibration.",
    },
    {
      kind: "OFFER" as const,
      t: "03:01",
      title: "Revised offer",
      body: `${primary.provider} · counter after ${2} tactics`,
      amount: primary.revisedOfferMinor,
    },
  ];

  return (
    <div className="page-shell">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <span className="h-1 w-6 bg-primary" /> Step 04 · Negotiation
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Negotiation trail</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Every tactic runs through the policy engine. The agent may only cite a fact after it
              has been minted as a VerifiedFact.
            </p>
          </div>
          <HashChip hash={primary.jobSpecHash} />
        </div>
      </header>

      {/* Hero savings */}
      <section className="panel relative overflow-hidden mb-6">
        <div
          className="absolute inset-0 opacity-70 pointer-events-none"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-6 px-5 py-7 sm:px-7">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="h-3 w-3" /> Verified savings
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="mono text-4xl font-semibold tracking-[-0.05em] text-primary drop-shadow-[0_0_20px_var(--color-primary)] sm:text-5xl">
                {formatMoney(savings)}
              </span>
              <span className="text-sm text-muted-foreground">on {primary.provider}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 mono text-sm">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Original
              </div>
              <div className="text-lg line-through decoration-danger/60 text-muted-foreground">
                {formatMoney(primary.originalOfferMinor)}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Revised
              </div>
              <div className="text-lg font-semibold text-foreground">
                {formatMoney(primary.revisedOfferMinor)}
              </div>
            </div>
            <div className="ml-4 flex items-center gap-1 rounded-md border border-success/40 bg-success/10 px-2 py-1 text-success">
              <TrendingDown className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold">
                -{Math.round((savings / (primary.originalOfferMinor ?? 1)) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <section className="lg:col-span-2 panel p-6">
          <h2 className="text-sm font-semibold tracking-tight mb-4">Timeline</h2>
          <ol className="relative border-l border-border ml-2 space-y-5">
            {timeline.map((step, i) => {
              const cfg = {
                OFFER: { dot: "bg-info", text: "text-info", label: "OFFER" },
                POLICY: { dot: "bg-primary", text: "text-primary", label: "POLICY" },
                TACTIC: { dot: "bg-warning", text: "text-warning", label: "TACTIC" },
              }[step.kind];
              return (
                <li key={i} className="interactive-row pl-6 relative">
                  <span
                    className={cn(
                      "absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background",
                      cfg.dot,
                    )}
                  />
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "mono text-[10px] font-semibold tracking-[0.12em]",
                            cfg.text,
                          )}
                        >
                          {cfg.label}
                        </span>
                        <span className="mono text-[10px] text-muted-foreground/70">{step.t}</span>
                      </div>
                      <div className="mt-0.5 text-sm font-semibold">{step.title}</div>
                      <div className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
                        {step.body}
                      </div>
                    </div>
                    {step.amount !== undefined && (
                      <div className="mono text-lg font-semibold shrink-0">
                        {formatMoney(step.amount)}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Policy log */}
        <section className="panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-tight">Policy decisions</h2>
            <span className="mono text-[10px] text-muted-foreground">4 entries</span>
          </div>
          <ul className="space-y-2">
            {POLICY_DECISIONS.map((p) => {
              const isDeny = p.decision === "DENY";
              return (
                <li
                  key={p.id}
                  className={cn(
                    "rounded-md border p-3",
                    isDeny
                      ? "border-danger/50 bg-danger/10 shadow-[0_0_0_1px_var(--color-danger)/30] ring-1 ring-danger/30"
                      : "border-border bg-background/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 mono text-[10px] font-bold tracking-[0.12em]",
                        isDeny ? "bg-danger text-danger-foreground" : "bg-success/20 text-success",
                      )}
                    >
                      {isDeny ? <Ban className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                      {p.decision}
                    </span>
                    <span className="mono text-[10px] text-muted-foreground">{p.timestamp}</span>
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-[12px] leading-relaxed",
                      isDeny ? "text-danger font-medium" : "text-foreground/80",
                    )}
                  >
                    {isDeny ? p.denyReason : p.allowedStatement}
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
            The policy engine denied 1 of 4 proposed statements. No unverified claims left the
            agent's mouth on this run.
          </div>
        </section>
      </div>
    </div>
  );
}
