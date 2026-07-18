/**
 * packages/policy — the honesty machine.
 * Core invariant (architecture doc §9.1): the LLM may ASK for leverage; it may not CREATE leverage.
 * Deny-by-default. Every decision is logged and demoable.
 */
import { QuoteOffer, VerifiedFact, PolicyDecision, Money } from "./domain";
import { createHash, randomUUID } from "node:crypto";

// ---------- fact minting: only the backend creates leverage ----------

/**
 * Mint a VerifiedFact from a fully-reconciled competing quote.
 * Returns null (refuses to mint) unless EVERY eligibility rule passes.
 * Called by the orchestrator after normalization — never by the LLM.
 */
export function mintCompetitorOfferFact(
  quote: QuoteOffer,
  specCoreSha256: string,
  now: Date = new Date()
): VerifiedFact | null {
  // Rule 1: quote must be for the same confirmed spec (scope equivalence)
  if (quote.comparability !== "COMPARABLE") return null;
  // Rule 2: total must reconcile — no leverage from mismatched math
  if (quote.totals.reconciliation !== "MATCH") return null;
  if (quote.totals.statedAllInMinor == null) return null;
  // Rule 3: still valid
  if (quote.terms.validUntil && new Date(quote.terms.validUntil) < now) return null;
  // Rule 4: every line item must carry provenance (schema enforces, we double-check)
  if (quote.lineItems.some(li => li.provenanceIds.length === 0)) return null;

  const dollars = (quote.totals.statedAllInMinor / 100).toFixed(0);
  const calib = quote.lineItems.find(li => li.category === "ADAS_CALIBRATION" && li.status === "INCLUDED");

  return {
    factId: `fact_${randomUUID()}`,
    kind: "COMPETITOR_ALL_IN_OFFER",
    subjectProviderId: quote.providerId,
    amountMinor: quote.totals.statedAllInMinor,
    scopeHash: specCoreSha256 as VerifiedFact["scopeHash"],
    validUntil: quote.terms.validUntil,
    provenanceIds: quote.lineItems.flatMap(li => li.provenanceIds),
    // The ONLY sentence the agent may speak. Deterministic. No rounding down, no embellishment.
    allowedClaim: calib
      ? `I have a verified all-in quote of $${dollars} for the same vehicle, including ADAS calibration.`
      : `I have a verified quote of $${dollars} for the same vehicle.`,
    status: "ACTIVE",
  };
}

// ---------- leverage requests: deny-by-default ----------

export interface LeverageRequest {
  callId: string;
  targetProviderId: string;
  desiredConcession: "PRICE_MATCH" | "WAIVE_FEE" | "TERM_IMPROVEMENT";
  round: number; // 1..3
}

export function requestLeverage(
  req: LeverageRequest,
  activeFacts: VerifiedFact[],
  priorRoundsThisCall: number,
  now: Date = new Date()
): PolicyDecision {
  const base = {
    decisionId: `dec_${randomUUID()}`,
    callId: req.callId,
    requested: `${req.desiredConcession} (round ${req.round})`,
    at: now.toISOString(),
    round: Math.min(Math.max(req.round, 1), 3) as 1 | 2 | 3,
  };

  // Concession ladder: hard stop after 3 rounds
  if (priorRoundsThisCall >= 3) {
    return { ...base, decision: "DENY", factIds: [], allowedStatement: null,
      denyReason: "Concession ladder exhausted (max 3 rounds). End the call politely." };
  }

  // Never use a provider's own quote against itself
  const usable = activeFacts.filter(f =>
    f.status === "ACTIVE" &&
    f.subjectProviderId !== req.targetProviderId &&
    (!f.validUntil || new Date(f.validUntil) >= now)
  );

  if (usable.length === 0) {
    return { ...base, decision: "DENY", factIds: [], allowedStatement: null,
      denyReason: "No active verified fact exists. You may NOT imply any competing offer. " +
        "You may still ask a plain question like: 'Is that your best all-in price?'" };
  }

  // Release exactly ONE fact per round — strongest first (lowest competitor total)
  const best = [...usable].sort((a, b) => (a.amountMinor ?? Infinity) - (b.amountMinor ?? Infinity))[0];

  return { ...base, decision: "ALLOW", factIds: [best.factId],
    allowedStatement: best.allowedClaim, denyReason: null };
}

// ---------- normalization helpers (deterministic — the LLM never does math) ----------

export function computeKnownTotal(quote: Pick<QuoteOffer, "lineItems">): {
  computedKnownMinor: number;
  isAllIn: boolean; // false if ANY required category is UNKNOWN — unknown is never zero
  unknownCategories: string[];
} {
  const REQUIRED = ["BASE_GLASS_AND_INSTALL", "ADAS_CALIBRATION", "TAX"];
  let total = 0;
  const unknown: string[] = [];
  const seen = new Set<string>();

  for (const li of quote.lineItems) {
    seen.add(li.category);
    if (li.status === "INCLUDED" && li.amountMinor != null) total += li.amountMinor;
    if (li.status === "UNKNOWN") unknown.push(li.category);
  }
  for (const req of REQUIRED) if (!seen.has(req)) unknown.push(req);

  return { computedKnownMinor: total, isAllIn: unknown.length === 0, unknownCategories: unknown };
}

export function applyRedFlags(
  quote: QuoteOffer,
  comparableTotalsMinor: number[], // stated all-in totals of OTHER comparable quotes
  vehicleHasCamera: boolean
): QuoteOffer["redFlags"] {
  const flags: QuoteOffer["redFlags"] = [];

  const calib = quote.lineItems.find(li => li.category === "ADAS_CALIBRATION");
  if (vehicleHasCamera && (!calib || calib.status === "UNKNOWN" || calib.status === "EXCLUDED")) {
    flags.push({ code: "CALIBRATION_OMITTED",
      detail: "Vehicle has a windshield camera but calibration is not included in this quote. Real total is likely higher." });
  }

  if (quote.totals.statedAllInMinor != null && comparableTotalsMinor.length >= 2) {
    const sorted = [...comparableTotalsMinor].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (quote.totals.statedAllInMinor < median * 0.7) {
      flags.push({ code: "SUSPICIOUS_LOWBALL",
        detail: `Quote is 30%+ below the median of comparable quotes ($${(median / 100).toFixed(0)}). Warning sign, not a win.` });
    }
  }

  if (quote.totals.reconciliation === "TOTAL_MISMATCH") {
    flags.push({ code: "TOTAL_MISMATCH", detail: "Stated total does not match the sum of itemized fees." });
  }

  return flags;
}

// ---------- deterministic ranking (weights from architecture doc §10) ----------

const WEIGHTS = { price: 45, completeness: 20, scopeQuality: 15, schedule: 10, terms: 10 };

export function rankQuotes(quotes: QuoteOffer[]): {
  quoteId: string; eligible: boolean; ineligibleReason: string | null;
  score: number | null; componentScores: Record<string, number> | null; visiblePenalties: string[];
}[] {
  const eligible = quotes.filter(q =>
    q.comparability !== "NON_COMPARABLE" &&
    q.totals.statedAllInMinor != null &&
    !q.redFlags.some(f => f.code === "TOTAL_MISMATCH")
  );
  const prices = eligible.map(q => q.totals.statedAllInMinor!);
  const min = Math.min(...prices), max = Math.max(...prices);

  return quotes.map(q => {
    if (!eligible.includes(q)) {
      return { quoteId: q.quoteId, eligible: false,
        ineligibleReason: q.comparability === "NON_COMPARABLE" ? "Scope not comparable" : "No reconciled all-in total",
        score: null, componentScores: null,
        visiblePenalties: q.redFlags.map(f => f.code) };
    }
    const p = q.totals.statedAllInMinor!;
    const priceScore = max === min ? 1 : (max - p) / (max - min);
    const completeness = q.lineItems.filter(li => li.status !== "UNKNOWN").length / Math.max(q.lineItems.length, 1);
    const written = q.terms.writtenConfirmation ? 1 : 0.5;
    const cs = {
      price: priceScore * WEIGHTS.price,
      completeness: completeness * WEIGHTS.completeness,
      scopeQuality: (q.comparability === "COMPARABLE" ? 1 : 0.6) * WEIGHTS.scopeQuality,
      schedule: (q.terms.appointmentWindow !== "UNKNOWN" ? 1 : 0.5) * WEIGHTS.schedule,
      terms: written * WEIGHTS.terms,
    };
    // Red-flag penalties are VISIBLE, applied after component scores — never hidden in a weight
    const penalty = q.redFlags.length * 8;
    return { quoteId: q.quoteId, eligible: true, ineligibleReason: null,
      score: Math.round((cs.price + cs.completeness + cs.scopeQuality + cs.schedule + cs.terms - penalty) * 10) / 10,
      componentScores: cs, visiblePenalties: q.redFlags.map(f => f.code) };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

// ---------- spec freezing ----------

export function freezeSpecCore(core: unknown): string {
  // Canonical JSON (sorted keys) → sha256. Same core from voice or document ⇒ same hash.
  const canonical = JSON.stringify(core, Object.keys(core as object).sort());
  return createHash("sha256").update(canonical).digest("hex");
}
