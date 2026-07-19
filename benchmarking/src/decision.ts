import type { BackendBenchmark, BenchmarkHandoff, PriceDecision } from "./contracts.js";

const TOLERANCE_PERCENT = 30 as const;

function sourceConfidence(handoff: BenchmarkHandoff) {
  if (handoff.liveQuoteBenchmark && handoff.liveQuoteBenchmark.sampleSize >= 3) return 0.9;
  if (handoff.liveQuoteBenchmark) return 0.8;
  if (handoff.strongEvidence.length && handoff.directionalEvidence.length) return 0.7;
  if (handoff.directionalEvidence.length) return 0.55;
  return 0.3;
}

export function evaluateVendorPrice(quoteMinor: number, handoff: BenchmarkHandoff): PriceDecision {
  if (!Number.isInteger(quoteMinor) || quoteMinor < 0) throw new Error("quoteMinor must be nonnegative integer cents");
  const hasVehicleEvidence = handoff.directionalEvidence.some(s => s.conditions.some(c => c.startsWith("Vehicle match:")));
  if (!handoff.liveQuoteBenchmark && handoff.request.vehicle && !hasVehicleEvidence) throw new Error("vehicle-specific evidence is required before evaluating this quote");
  const range = handoff.liveQuoteBenchmark
    ? [handoff.liveQuoteBenchmark.lowMinor, handoff.liveQuoteBenchmark.highMinor] as const
    : handoff.callGuidance.expectedRangeMinor;
  if (!range) throw new Error("cannot evaluate a quote without a benchmark range");
  const benchmarkHighMinor = range[1];
  const maximumReasonableMinor = Math.round(benchmarkHighMinor * 1.3);
  const percentAboveBenchmarkHigh = Math.round(((quoteMinor - benchmarkHighMinor) / benchmarkHighMinor) * 1000) / 10;
  const overpriced = quoteMinor > maximumReasonableMinor;
  return {
    action: overpriced ? "REJECT_OVERPRICED" : "CONTINUE",
    quoteMinor, benchmarkHighMinor, maximumReasonableMinor,
    tolerancePercent: TOLERANCE_PERCENT,
    percentAboveBenchmarkHigh,
    confidence: sourceConfidence(handoff),
    reason: overpriced
      ? `Quote is ${percentAboveBenchmarkHigh}% above the benchmark high and exceeds the 30% tolerance. Show it to the user as overpriced; do not negotiate it.`
      : `Quote is within the benchmark high plus the 30% tolerance.`
  };
}

export function toBackendBenchmark(handoff: BenchmarkHandoff): BackendBenchmark {
  const range = handoff.liveQuoteBenchmark
    ? [handoff.liveQuoteBenchmark.lowMinor, handoff.liveQuoteBenchmark.typicalMinor, handoff.liveQuoteBenchmark.highMinor] as const
    : handoff.callGuidance.expectedRangeMinor
      ? [handoff.callGuidance.expectedRangeMinor[0], Math.round((handoff.callGuidance.expectedRangeMinor[0] + handoff.callGuidance.expectedRangeMinor[1]) / 2), handoff.callGuidance.expectedRangeMinor[1]] as const
      : null;
  if (!range) throw new Error("cannot adapt an empty benchmark");
  const verified = Boolean(handoff.liveQuoteBenchmark);
  return {
    lowMinor: range[0], typicalMinor: range[1], highMinor: range[2],
    classification: verified ? "VERIFIED" : "ESTIMATED",
    sourceLabel: verified
      ? `${handoff.liveQuoteBenchmark!.sampleSize} reconciled local quotes`
      : "Source-backed published auto-glass range",
    notes: [
      `Confidence ${Math.round(sourceConfidence(handoff) * 100)}%.`,
      "Quotes above the benchmark high by more than 30% should map to WALK_AWAY.",
      ...handoff.callGuidance.warnings
    ],
    generatedAt: handoff.generatedAt
  };
}

export function toBackendRecommendation(decision: PriceDecision, offerId: string) {
  return {
    action: decision.action === "REJECT_OVERPRICED" ? "WALK_AWAY" as const : "COUNTER" as const,
    offerId,
    summary: decision.action === "REJECT_OVERPRICED" ? "Quote is overpriced relative to the source-backed benchmark." : "Quote is within the allowed benchmark range.",
    reasons: [decision.reason, `Benchmark confidence is ${Math.round(decision.confidence * 100)}%.`],
    suggestedCounterMinor: decision.action === "REJECT_OVERPRICED" ? null : decision.benchmarkHighMinor,
    createdAt: new Date().toISOString()
  };
}
