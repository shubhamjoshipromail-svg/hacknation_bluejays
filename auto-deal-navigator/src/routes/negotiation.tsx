import { createFileRoute } from "@tanstack/react-router";
import { Ban, Check, ShieldCheck, TrendingDown } from "lucide-react";
import { formatMoney } from "@/lib/mock-data";
import { useRunsData } from "@/hooks/use-runs-data";
import { HashChip } from "@/components/ui-bits";

export const Route = createFileRoute("/negotiation")({
  component: NegotiationPage,
  head: () => ({
    meta: [
      { title: "Negotiation · The Negotiator" },
      {
        name: "description",
        content: "Policy-audited negotiation using only transcript-backed facts.",
      },
    ],
  }),
});

function NegotiationPage() {
  const { quotes, policyDecisions, negotiation } = useRunsData();
  const initial = quotes.find((q) => q.originalOfferMinor !== undefined),
    revised = quotes.find((q) => q.revisedOfferMinor !== undefined),
    savings =
      (initial?.originalOfferMinor ?? 0) -
      (revised?.revisedOfferMinor ?? initial?.originalOfferMinor ?? 0);
  if (!initial)
    return (
      <div className="px-6 py-10 md:px-10">
        <h1 className="text-3xl font-semibold">Negotiation trail</h1>
        <div className="panel mt-6 p-8 text-sm text-muted-foreground">
          Negotiation begins only after the sandbox provider confirms a usable quote. No competitor
          claim is allowed without a separate comparable quote.
        </div>
      </div>
    );
  return (
    <div className="px-6 py-8 md:px-10 md:py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <span className="h-1 w-6 bg-primary" />
          Step 04 · Negotiation
        </div>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Negotiation trail</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Only transcript-backed facts released by deterministic policy may be used as leverage.
            </p>
          </div>
          <HashChip hash={initial.jobSpecHash} />
        </div>
      </header>
      <section className="panel relative mb-6 overflow-hidden">
        <div
          className="absolute inset-0 opacity-70 pointer-events-none"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-6 px-6 py-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              <TrendingDown className="h-3 w-3" />
              Verified savings
            </div>
            <div className="mt-2 mono text-4xl font-semibold text-primary">
              {revised ? formatMoney(Math.max(0, savings)) : "Awaiting follow-up"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Initial all-in
            </div>
            <div className="mono text-2xl font-semibold">
              {formatMoney(initial.originalOfferMinor)}
            </div>
            {revised && (
              <div className="mt-2 text-sm text-success">
                Revised to {formatMoney(revised.revisedOfferMinor)}
              </div>
            )}
          </div>
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold">Recorded offers and policy events</h2>
          <div className="mt-4 space-y-3">
            {quotes.map((quote) => (
              <div
                key={quote.quoteId}
                className="rounded-md border border-border bg-panel-2/40 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {quote.revisedOfferMinor !== undefined ? "Negotiated offer" : "Initial offer"}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{quote.provider}</p>
                  </div>
                  <p className="mono text-lg font-semibold">
                    {formatMoney(quote.revisedOfferMinor ?? quote.originalOfferMinor)}
                  </p>
                </div>
              </div>
            ))}
            {policyDecisions.map((decision) => (
              <div key={decision.id} className="rounded-md border border-border p-4">
                <div className="flex gap-2">
                  {decision.decision === "ALLOW" ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Ban className="h-4 w-4 text-warning" />
                  )}
                  <div>
                    <p className="text-xs font-semibold">Policy {decision.decision}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {decision.allowedStatement ?? decision.denyReason}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {policyDecisions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No leverage request has been made. With one sandbox provider, competitor-price
                claims remain denied by default.
              </p>
            )}
          </div>
        </section>
        <aside className="panel p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Policy boundary</h2>
          </div>
          <ul className="mt-4 space-y-3 text-xs text-muted-foreground">
            <li>Exact verified prices only—no bluffing or rounding.</li>
            <li>At most three concession rounds per call.</li>
            <li>VIN is provided only if the provider asks.</li>
            <li>No booking, purchase, acceptance, or binding commitment.</li>
          </ul>
          <p className="mt-5 rounded border border-border bg-panel-2/40 p-3 text-[11px] text-muted-foreground">
            Run {negotiation?.negotiationId.slice(0, 12)}
          </p>
        </aside>
      </div>
    </div>
  );
}
