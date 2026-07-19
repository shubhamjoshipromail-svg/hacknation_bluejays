import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  formatMoney,
  quoteTotalMinor,
  hasUnknown,
  type Quote,
  type LineItem,
} from "@/lib/mock-data";
import { useRunsData } from "@/hooks/use-runs-data";
import { HashChip } from "@/components/ui-bits";
import { cn } from "@/lib/utils";
import { AlertTriangle, HelpCircle, X } from "lucide-react";

export const Route = createFileRoute("/compare")({
  component: ComparePage,
  head: () => ({
    meta: [
      { title: "Compare Quotes · The Negotiator" },
      {
        name: "description",
        content: "Side-by-side itemized quote comparison with red-flag detection.",
      },
    ],
  }),
});

const CATEGORIES = [
  "Glass & install",
  "ADAS calibration",
  "Mobile service",
  "Moldings / clips",
  "Disposal",
  "Tax",
] as const;

function findItem(q: Quote, category: string): LineItem | undefined {
  return q.lineItems.find((li) => li.category === category);
}

interface DrawerCtx {
  quote: Quote;
  item: LineItem;
}

function Cell({
  item,
  onClick,
  redFlag,
}: {
  item?: LineItem;
  onClick: () => void;
  redFlag?: string;
}) {
  if (!item || item.status === "UNKNOWN") {
    return (
      <td className="px-4 py-3 text-right align-top">
        <button
          onClick={onClick}
          className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 mono text-xs text-warning hover:bg-warning/20"
        >
          <HelpCircle className="h-3 w-3" /> ?
        </button>
      </td>
    );
  }
  if (item.status === "EXCLUDED") {
    return (
      <td className="px-4 py-3 text-right align-top">
        <button
          onClick={onClick}
          className="inline-flex items-center gap-1 rounded-md border border-danger/40 bg-danger/10 px-2 py-0.5 mono text-xs text-danger hover:bg-danger/20"
        >
          excluded
        </button>
        {redFlag && (
          <div className="mt-1 inline-flex items-center gap-1 rounded-sm border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger">
            <AlertTriangle className="h-2.5 w-2.5" /> {redFlag}
          </div>
        )}
      </td>
    );
  }
  return (
    <td className="px-4 py-3 text-right align-top">
      <button
        onClick={onClick}
        className="mono text-sm text-foreground hover:text-primary underline decoration-dotted underline-offset-4"
      >
        {formatMoney(item.amountMinor)}
      </button>
    </td>
  );
}

function ComparePage() {
  const { quotes: QUOTES } = useRunsData();
  const [drawer, setDrawer] = useState<DrawerCtx | null>(null);

  const redFlagsByQuote: Record<string, Record<string, string>> = {
    q_ricks: { "ADAS calibration": "Calibration omitted" },
  };

  return (
    <div className="px-6 py-8 md:px-10 md:py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <span className="h-1 w-6 bg-primary" /> Step 03 · Compare Quotes
        </div>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Itemized comparison</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Every fee category, side by side. Amber "?" means the shop never mentioned it — we
              don't invent zeros.
            </p>
          </div>
          {QUOTES[0] && <HashChip hash={QUOTES[0].jobSpecHash} />}
        </div>
      </header>

      <div className="panel overflow-hidden">
        {QUOTES.length === 0 && (
          <div className="p-8 text-sm text-muted-foreground">
            No validated quote is available yet. This page updates after the sandbox call completes.
          </div>
        )}
        {QUOTES.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-panel-2/60 text-left">
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Category
                  </th>
                  {QUOTES.map((q) => (
                    <th key={q.quoteId} className="px-4 py-3 text-right min-w-[200px]">
                      <div className="text-sm font-semibold">{q.provider}</div>
                      <div className="text-[11px] font-normal text-muted-foreground">
                        {q.location}
                      </div>
                      {q.redFlags.length > 0 && (
                        <div className="mt-1 flex flex-wrap justify-end gap-1">
                          {q.redFlags.map((f) => (
                            <span
                              key={f}
                              className="inline-flex items-center gap-1 rounded-sm border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger"
                            >
                              <AlertTriangle className="h-2.5 w-2.5" /> {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((cat) => (
                  <tr key={cat} className="border-b border-border/60 hover:bg-panel-2/30">
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm">{cat}</div>
                    </td>
                    {QUOTES.map((q) => {
                      const li = findItem(q, cat);
                      return (
                        <Cell
                          key={q.quoteId}
                          item={li}
                          redFlag={redFlagsByQuote[q.quoteId]?.[cat]}
                          onClick={() => li && setDrawer({ quote: q, item: li })}
                        />
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t-2 border-primary/40 bg-primary/[0.04]">
                  <td className="px-4 py-4 align-top">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                      ALL-IN TOTAL
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      verified categories only
                    </div>
                  </td>
                  {QUOTES.map((q) => {
                    const total = quoteTotalMinor(q);
                    const unknown = hasUnknown(q.lineItems);
                    return (
                      <td key={q.quoteId} className="px-4 py-4 text-right align-top">
                        <div className="mono text-lg font-semibold text-foreground">
                          {formatMoney(total)}
                        </div>
                        {unknown && (
                          <div className="mt-0.5 mono text-[10px] text-warning">
                            + unknown categories
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Click any $ amount to open evidence — transcript excerpt, speaker, timestamp, and provenance
        IDs.
      </p>

      {/* Evidence drawer */}
      {drawer && <EvidenceDrawer ctx={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

function EvidenceDrawer({ ctx, onClose }: { ctx: DrawerCtx; onClose: () => void }) {
  const { quote, item } = ctx;
  const turn =
    quote.transcriptTurns.find((t) =>
      t.text.toLowerCase().includes(item.category.split(" ")[0].toLowerCase()),
    ) ?? quote.transcriptTurns[0];

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
              Evidence
            </div>
            <h3 className="text-sm font-semibold">{item.category}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-5 space-y-4">
          <div className="rounded-md border border-border bg-background/40 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                {quote.provider}
              </span>
              <span className="mono text-lg font-semibold">
                {item.status === "INCLUDED" ? formatMoney(item.amountMinor) : item.status}
              </span>
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">"{item.rawLabel}"</div>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Transcript excerpt
            </div>
            <div className="rounded-md border border-border bg-background/40 p-4">
              <div className="flex items-center gap-2 text-[10px] mono">
                <span
                  className={cn(
                    "font-semibold",
                    turn.speaker === "AGENT" ? "text-primary" : "text-info",
                  )}
                >
                  {turn.speaker}
                </span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground/60">{turn.timestamp}</span>
                <span className="text-muted-foreground/60">·</span>
                <span className="text-muted-foreground/60">turn {turn.turnId}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed">"{turn.text}"</p>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Provenance
            </div>
            <div className="flex flex-wrap gap-1">
              {item.provenanceIds.length ? (
                item.provenanceIds.map((p) => (
                  <span
                    key={p}
                    className="rounded-sm border border-border bg-background/40 px-2 py-0.5 mono text-[10px]"
                  >
                    {p}
                  </span>
                ))
              ) : (
                <span className="mono text-[11px] text-warning">no provenance — flagged</span>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
