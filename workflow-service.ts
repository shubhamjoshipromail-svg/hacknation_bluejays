import { discoverSandboxProviders } from "./provider-search-service.js";
import { startElevenLabsCall } from "./elevenlabs-call-service.js";
import {
  applyBenchmarkContext,
  createSandboxNegotiation,
  getNegotiation,
  recommend,
  revalidateOffers,
  prepareNegotiationStrategy,
} from "./negotiation-service.js";
import { SandboxIntake } from "./domain.js";
import { benchmarkSandboxIntake } from "./benchmark-service.js";
import { eligibleRealProviders } from "./provider-consent-service.js";

export type CallStarter = typeof startElevenLabsCall;
export type BenchmarkRunner = typeof benchmarkSandboxIntake;

export async function advanceSandboxWorkflow(
  negotiationId: string,
  startCall: CallStarter = startElevenLabsCall,
) {
  revalidateOffers(negotiationId);
  const n = getNegotiation(negotiationId),
    quoteCalls = n.calls.filter((c) => c.phase === "QUOTE_COLLECTION" && c.isActiveAttempt);
  if (
    quoteCalls.some((c) => c.status === "QUEUED" || c.status === "IN_PROGRESS")
  )
    return n;
  const uncalled = n.providers.find(
    (provider) =>
      !quoteCalls.some((call) => call.providerId === provider.providerId),
  );
  if (uncalled)
    return startCall(negotiationId, uncalled.providerId, "QUOTE_COLLECTION");
  const negotiationCall = n.calls
    .filter((c) => c.phase === "NEGOTIATION" && c.isActiveAttempt)
    .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
  if (negotiationCall) {
    if (
      negotiationCall.status === "COMPLETE" ||
      negotiationCall.status === "FAILED"
    )
      return n.offers.length
        ? recommend(negotiationId)
        : getNegotiation(negotiationId);
    return n;
  }
  const comparable = n.offers
    .filter(
      (o) =>
        o.stage === "INITIAL" &&
        o.comparability === "COMPARABLE" &&
        o.totals.reconciliation === "MATCH" &&
        o.totals.statedAllInMinor != null,
    )
    .sort((a, b) => b.totals.statedAllInMinor! - a.totals.statedAllInMinor!);
  const target = comparable.find((candidate) =>
    comparable.some(
      (other) =>
        other.providerId !== candidate.providerId &&
        other.totals.statedAllInMinor! < candidate.totals.statedAllInMinor!,
    ),
  );
  if (target) prepareNegotiationStrategy(negotiationId, target.providerId);
  return target
    ? startCall(negotiationId, target.providerId, "NEGOTIATION")
    : n.offers.length
      ? recommend(negotiationId)
      : getNegotiation(negotiationId);
}

export async function retrySandboxNegotiation(
  negotiationId: string,
  startCall: CallStarter = startElevenLabsCall,
) {
  revalidateOffers(negotiationId);
  const n = getNegotiation(negotiationId);
  if (
    n.calls.some(
      (call) =>
        call.phase === "NEGOTIATION" && call.isActiveAttempt &&
        (call.status === "QUEUED" || call.status === "IN_PROGRESS"),
    )
  )
    throw new Error("a negotiation call is already active");
  const comparable = n.offers
    .filter(
      (offer) =>
        offer.stage === "INITIAL" &&
        offer.comparability === "COMPARABLE" &&
        offer.totals.reconciliation === "MATCH" &&
        offer.totals.statedAllInMinor != null,
    )
    .sort((a, b) => b.totals.statedAllInMinor! - a.totals.statedAllInMinor!);
  const target = comparable.find((candidate) =>
    comparable.some(
      (other) =>
        other.providerId !== candidate.providerId &&
        other.totals.statedAllInMinor! < candidate.totals.statedAllInMinor!,
    ),
  );
  if (!target)
    throw new Error("two differently priced comparable offers are required");
  prepareNegotiationStrategy(negotiationId, target.providerId);
  return startCall(negotiationId, target.providerId, "NEGOTIATION");
}

export function submitSandboxWorkflow(
  input: unknown,
  env: NodeJS.ProcessEnv = process.env,
  startCall: CallStarter = startElevenLabsCall,
  runBenchmark: BenchmarkRunner = benchmarkSandboxIntake,
) {
  const request = SandboxIntake.parse(input),
    realMode = (env.CALL_MODE ?? "SANDBOX") === "REAL",
    providers = realMode ? eligibleRealProviders() : discoverSandboxProviders(request.postalCode, env);
  if (realMode && !providers.length) throw new Error("no opted-in North Carolina providers are eligible for calling");
  const negotiation = createSandboxNegotiation(request, providers, realMode ? "REAL" : "SANDBOX");
  void (async () => {
    try {
      const result = await runBenchmark(request);
      applyBenchmarkContext(
        negotiation.negotiationId,
        result.benchmark,
        result.context,
      );
    } catch (error) {
      console.warn(`[sandbox benchmark ${negotiation.negotiationId}]`, error);
    }
    await startCall(
      negotiation.negotiationId,
      providers[0].providerId,
      "QUOTE_COLLECTION",
    );
  })().catch((error) =>
    console.error(`[sandbox workflow ${negotiation.negotiationId}]`, error),
  );
  return negotiation;
}
