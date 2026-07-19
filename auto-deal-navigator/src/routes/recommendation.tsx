import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { formatMoney, quoteTotalMinor, type Quote, type RankingEntry } from "@/lib/mock-data";
import { api, useRunsData, type NegotiationData } from "@/hooks/use-runs-data";
import { HashChip } from "@/components/ui-bits";
import { cn } from "@/lib/utils";
import { Trophy, X, AlertTriangle, PhoneCall, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/recommendation")({
  component: RecommendationPage,
  head: () => ({
    meta: [
      { title: "Recommendation · The Negotiator" },
      {
        name: "description",
        content: "Ranked provider recommendation with evidence-backed score components.",
      },
    ],
  }),
});

function ScoreBar({ label, value }: { label: string; value: number }) {
  const cls =
    value >= 80 ? "bg-primary" : value >= 55 ? "bg-info" : value >= 35 ? "bg-warning" : "bg-danger";
  return (
    <div>
      <div className="flex justify-between text-[10px] mono text-muted-foreground">
        <span className="uppercase tracking-[0.12em]">{label}</span>
        <span className="text-foreground">{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-border/60 overflow-hidden">
        <div className={cn("h-full rounded-full", cls)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

interface EvidenceCtx {
  label: string;
  value: string;
  quoteId: string;
}

function RecommendationPage() {
  const { quotes: QUOTES, ranking: RANKING, negotiation, refresh } = useRunsData();
  const [ev, setEv] = useState<EvidenceCtx | null>(null);
  const winner = RANKING[0];
  const rec = negotiation?.recommendation ?? null;
  if (!winner || QUOTES.length === 0)
    return (
      <div className="px-6 py-10 md:px-10">
        <h1 className="text-3xl font-semibold">Recommendation</h1>
        {rec && QUOTES.length > 0 ? (
          <div className="panel mt-6 p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Agent recommendation · {rec.action}
            </div>
            <p className="mt-2 text-sm">{rec.summary}</p>
            <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
              {rec.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="panel mt-6 p-8 text-sm text-muted-foreground">
            No recommendation is available until at least one itemized offer has been recorded and
            checked for comparability and red flags.
          </div>
        )}
      </div>
    );
  const winnerQuote = QUOTES.find((q) => q.quoteId === winner.quoteId) ?? QUOTES[0];

  return (
    <div className="px-6 py-8 md:px-10 md:py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <span className="h-1 w-6 bg-primary" /> Step 05 · Recommendation
        </div>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Best deal</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Ranked by price, completeness, trust, and logistics. Every number is backed by a
              transcript excerpt.
            </p>
          </div>
          <HashChip hash={winnerQuote.jobSpecHash} />
        </div>
      </header>

      {/* Winner */}
      <section className="panel relative overflow-hidden mb-6">
        <div
          className="absolute inset-0 opacity-70 pointer-events-none"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              <Trophy className="h-3 w-3" /> Winner · rank 01
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{winnerQuote.provider}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{winnerQuote.location}</p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-foreground/90">
              {winner.explanation}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={() =>
                  setEv({
                    label: "All-in total",
                    value: formatMoney(quoteTotalMinor(winnerQuote)),
                    quoteId: winnerQuote.quoteId,
                  })
                }
                className="mono text-3xl font-semibold text-foreground hover:text-primary underline decoration-dotted underline-offset-8"
              >
                {formatMoney(quoteTotalMinor(winnerQuote))}
              </button>
              <span className="text-xs text-muted-foreground">all-in · tap for evidence</span>
            </div>
          </div>

          <div className="rounded-md border border-primary/30 bg-background/50 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Composite score
              </span>
              <span className="mono text-3xl font-semibold text-primary">{winner.score}</span>
            </div>
            <div className="mt-4 space-y-3">
              <ScoreBar label="Price" value={winner.componentScores.price} />
              <ScoreBar label="Completeness" value={winner.componentScores.completeness} />
              <ScoreBar label="Trust" value={winner.componentScores.trust} />
              <ScoreBar label="Logistics" value={winner.componentScores.logistics} />
            </div>
          </div>
        </div>
      </section>

      {negotiation && (
        <ReservationPanel negotiation={negotiation} quote={winnerQuote} refresh={refresh} />
      )}

      {/* Full ranked list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Full ranking</h2>
          <span className="mono text-[10px] text-muted-foreground">{RANKING.length} providers</span>
        </div>
        {RANKING.map((r, i) => (
          <RankRow key={r.quoteId} r={r} rank={i + 1} quotes={QUOTES} onEvidence={setEv} />
        ))}
      </section>

      {ev && <EvidenceDrawer ctx={ev} quotes={QUOTES} onClose={() => setEv(null)} />}
    </div>
  );
}

function ReservationPanel({
  negotiation,
  quote,
  refresh,
}: {
  negotiation: NegotiationData;
  quote: Quote;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmationCall = negotiation.calls.filter((c) => c.phase === "CONFIRMATION").at(-1);
  const accepted = negotiation.approvals.some((a) => a.action === "ACCEPT_OFFER");
  const total = quoteTotalMinor(quote);
  const place = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!accepted)
        await api(`/api/negotiations/${negotiation.negotiationId}/approvals`, {
          method: "POST",
          body: JSON.stringify({
            action: "ACCEPT_OFFER",
            details: `Accepted ${quote.provider} at ${formatMoney(total)}`,
          }),
        });
      await api(`/api/negotiations/${negotiation.negotiationId}/reservation-call`, {
        method: "POST",
        body: JSON.stringify({ providerId: quote.providerId }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reservation call failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel mb-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <PhoneCall className="h-3 w-3" /> Step 06 · Reservation call
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Approving here records an explicit <span className="mono">ACCEPT_OFFER</span> approval,
            then the agent calls {quote.provider} back to confirm the{" "}
            <span className="mono">{formatMoney(total)}</span> all-in total and hold an appointment.
            It never pays or books bindingly — final written confirmation stays with you.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-primary" /> Demo scope: 3 sandbox calls this run —
            a real run would canvass more shops before this step.
          </p>
        </div>
        <div className="text-right">
          {confirmationCall ? (
            <div className="rounded-md border border-border bg-panel-2/40 px-4 py-3 text-sm">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Reservation call
              </div>
              <div className="mt-1 font-semibold">
                {confirmationCall.status === "COMPLETE"
                  ? confirmationCall.outcome === "QUOTED"
                    ? "Reservation confirmed"
                    : `Ended: ${confirmationCall.outcome?.replaceAll("_", " ").toLowerCase() ?? "unknown"}`
                  : confirmationCall.status === "FAILED"
                    ? "Call failed"
                    : "Call in progress…"}
              </div>
              {confirmationCall.reason && (
                <div className="mt-1 max-w-[240px] text-[11px] text-muted-foreground">
                  {confirmationCall.reason}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => void place()}
              disabled={busy}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Placing call…" : "Approve & place reservation call"}
            </button>
          )}
          {error && <div className="mt-2 max-w-[260px] text-[11px] text-danger">{error}</div>}
        </div>
      </div>
    </section>
  );
}

function RankRow({
  r,
  rank,
  quotes,
  onEvidence,
}: {
  r: RankingEntry;
  rank: number;
  quotes: Quote[];
  onEvidence: (e: EvidenceCtx) => void;
}) {
  const q = quotes.find((x) => x.quoteId === r.quoteId) ?? quotes[0];
  const total = quoteTotalMinor(q);
  return (
    <article className="panel p-5">
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_auto] gap-5 items-start">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md mono text-sm font-semibold",
              rank === 1
                ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                : "bg-muted text-muted-foreground",
            )}
          >
            0{rank}
          </div>
          <div>
            <div className="text-sm font-semibold">{q.provider}</div>
            <div className="text-[11px] text-muted-foreground">{q.location}</div>
          </div>
        </div>

        <div>
          <div className="flex items-baseline gap-3">
            <button
              onClick={() =>
                onEvidence({
                  label: "All-in total",
                  value: formatMoney(total),
                  quoteId: q.quoteId,
                })
              }
              className="mono text-xl font-semibold hover:text-primary underline decoration-dotted underline-offset-4"
            >
              {formatMoney(total)}
            </button>
            <span className="text-[11px] text-muted-foreground">all-in</span>
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground max-w-md">{r.explanation}</div>
          {r.visiblePenalties.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.visiblePenalties.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded-sm border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger"
                >
                  <AlertTriangle className="h-2.5 w-2.5" /> {p}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 min-w-[200px]">
          <ScoreBar label="Price" value={r.componentScores.price} />
          <ScoreBar label="Complete" value={r.componentScores.completeness} />
          <ScoreBar label="Trust" value={r.componentScores.trust} />
          <ScoreBar label="Logistics" value={r.componentScores.logistics} />
        </div>

        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Score</div>
          <div
            className={cn(
              "mono text-3xl font-semibold",
              rank === 1 ? "text-primary" : "text-foreground",
            )}
          >
            {r.score}
          </div>
        </div>
      </div>
    </article>
  );
}

function EvidenceDrawer({
  ctx,
  quotes,
  onClose,
}: {
  ctx: EvidenceCtx;
  quotes: Quote[];
  onClose: () => void;
}) {
  const q = quotes.find((x) => x.quoteId === ctx.quoteId) ?? quotes[0];
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-panel shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Evidence for
            </div>
            <h3 className="text-sm font-semibold">
              {ctx.label} · <span className="mono text-primary">{ctx.value}</span>
            </h3>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{q.provider}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-5 space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Supporting transcript
          </div>
          {q.transcriptTurns.map((t) => (
            <div key={t.turnId} className="rounded-md border border-border bg-background/40 p-3">
              <div className="flex items-center gap-2 text-[10px] mono">
                <span
                  className={cn(
                    "font-semibold",
                    t.speaker === "AGENT" ? "text-primary" : "text-info",
                  )}
                >
                  {t.speaker}
                </span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground/60">{t.timestamp}</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground/60">turn {t.turnId}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed">"{t.text}"</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
