import type { BenchmarkHandoff, BenchmarkRequest, BenchmarkSignal, CallQuoteObservation, DiscoveredProvider } from "./contracts.js";

function median(values: number[]) { const i = Math.floor(values.length / 2); return values.length % 2 ? values[i] : Math.round((values[i - 1] + values[i]) / 2); }

export function liveQuoteBenchmark(observations: CallQuoteObservation[]) {
  const byProvider = new Map(observations.filter(o => o.sameVehicleAndScope && o.totalReconciles && o.statedAllInMinor != null).map(o => [o.providerId, o.statedAllInMinor!]));
  if (byProvider.size < 2) return null;
  const totals = [...byProvider.values()].sort((a, b) => a - b);
  return { lowMinor: totals[0], typicalMinor: median(totals), highMinor: totals.at(-1)!, sampleSize: totals.length };
}

export function createHandoff(request: BenchmarkRequest, providers: DiscoveredProvider[], signals: BenchmarkSignal[], observations: CallQuoteObservation[] = [], now = new Date().toISOString()): BenchmarkHandoff {
  const relevant = signals.filter(s => request.service === "NOT_SURE" || s.kind === request.service || (s.kind === "ADAS_CALIBRATION" && request.frontCamera !== false) || s.kind === "LABOR" || s.kind === "FEE");
  const live = liveQuoteBenchmark(observations);
  const matchingVehicleSignals = relevant.filter(s => s.kind === request.service && s.conditions.some(c => c.startsWith("Vehicle match:")));
  const serviceSignals = matchingVehicleSignals.length
    ? matchingVehicleSignals
    : relevant.filter(s => request.service === "NOT_SURE" ? s.kind === "REPAIR" || s.kind === "REPLACEMENT" : s.kind === request.service);
  const expected: [number, number] | null = live ? [live.lowMinor, live.highMinor] : serviceSignals.length ? [Math.min(...serviceSignals.map(s => s.lowMinor)), Math.max(...serviceSignals.map(s => s.highMinor))] : null;
  const warnings = ["Published ranges are directional and are not competing quotes."];
  if (request.frontCamera) warnings.push("Confirm that ADAS calibration is included and identify static, dynamic, or dual calibration.");
  if (!live) warnings.push("Two reconciled same-scope phone quotes are required before labeling a local benchmark verified.");
  return {
    schemaVersion: "1.0", generatedAt: now, request, providers,
    strongEvidence: relevant.filter(s => s.evidence.strength === "PRIMARY"),
    directionalEvidence: relevant.filter(s => s.evidence.strength !== "PRIMARY"),
    liveQuoteBenchmark: live,
    callGuidance: {
      expectedRangeMinor: expected,
      requiredQuestions: ["What is the itemized all-in cash price?", "Are glass, installation, supplies, moldings, disposal, mobile service, any required calibration, and tax included?", "What could change this price?", "How long is the quote valid, and can you send it in writing?"],
      warnings
    },
    updateInterface: { accepts: "CallQuoteObservation", rule: "Recompute after each call; use one latest reconciled, same-vehicle-and-scope INITIAL quote per provider; require at least two providers." }
  };
}
