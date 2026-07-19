import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  Intake,
  Negotiation,
  QuoteOffer,
  SandboxIntake,
  type ActionRecommendation,
  type Benchmark,
  type BenchmarkContext,
  type Negotiation as NegotiationType,
  type Provider,
  type SandboxIntake as SandboxIntakeType,
  type Strategy,
} from "./domain.js";
import { applyRedFlags, rankQuotes } from "./policy.js";
import { liveQuoteBenchmark } from "./benchmarking/src/aggregate.js";
import { quoteObservation } from "./benchmark-service.js";
import { mutate, store } from "./store.js";
import { decodeVin } from "./vin-service.js";
import type { RunView } from "./shared/contracts.js";
import { summarizeCallIntelligence } from "./call-intelligence.js";

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${randomUUID()}`;

function benchmark(): Benchmark {
  return {
    lowMinor: 55000,
    typicalMinor: 70000,
    highMinor: 90000,
    classification: "ESTIMATED",
    sourceLabel: "Internal auto-glass demo reference range",
    notes: [
      "Estimate only; verify against itemized local quotes.",
      "ADAS calibration can materially change the total.",
    ],
    generatedAt: now(),
  };
}
function refreshBenchmark(n: NegotiationType) {
  const described = n.intake.currentSituation.toLowerCase(),
    service =
      n.intake.damage.service !== "NOT_SURE"
        ? n.intake.damage.service
        : described.includes("replacement")
          ? "REPLACEMENT"
          : described.includes("repair")
            ? "REPAIR"
            : "NOT_SURE",
    observations = n.offers.flatMap((o) => {
      const value = quoteObservation(o, service);
      return value ? [value] : [];
    }),
    live = liveQuoteBenchmark(observations);
  if (!live) return;
  n.benchmark = {
    lowMinor: live.lowMinor,
    typicalMinor: live.typicalMinor,
    highMinor: live.highMinor,
    classification: "VERIFIED",
    sourceLabel: `${live.sampleSize} reconciled local phone quotes for the confirmed vehicle and scope`,
    notes: [
      "This benchmark is derived by the benchmarking vertical from comparable itemized initial quotes.",
      "Negotiated revisions are evaluated separately so they do not distort the initial market range.",
    ],
    generatedAt: now(),
  };
  if (n.benchmarkContext) {
    n.benchmarkContext.expectedRangeMinor = [live.lowMinor, live.highMinor];
    n.benchmarkContext.liveQuoteSampleSize = live.sampleSize;
  }
}
function strategyFor(intake: Intake, b: Benchmark): Strategy {
  const target = intake.desiredOutcomeMinor ?? b.typicalMinor;
  const walkAway = intake.walkAwayMinor ?? b.highMinor;
  return {
    objective: intake.objective,
    realisticTargetMinor: target,
    openingPositionMinor: Math.max(b.lowMinor, Math.round(target * 0.9)),
    acceptableMinMinor: b.lowMinor,
    acceptableMaxMinor: walkAway,
    walkAwayMinor: walkAway,
    keyArguments: [
      "Same confirmed vehicle and scope for every provider",
      "Ready to decide after receiving an itemized all-in quote",
      "Only verified competing quotes may be used as leverage",
    ],
    questions: [
      "Does the total include glass, installation, calibration, supplies, disposal, and tax?",
      "What warranty and written-price confirmation are included?",
      "What could change this price?",
    ],
    likelyObjections: [
      "We cannot quote without inspection",
      "Calibration is separate",
      "This price is only valid today",
    ],
    suggestedResponses: [
      "Please mark unknown items and explain what determines them.",
      "Please include the required camera calibration in the all-in figure.",
      "The customer will review the written terms before deciding.",
    ],
    offerConcessions: [
      "Flexible weekday scheduling",
      "In-shop service if it reduces the total",
    ],
    requestConcessions: [
      "Match a verified comparable quote",
      "Waive mobile or supply fees",
      "Provide written all-in confirmation",
    ],
    risksToAvoid: [
      "Binding commitment without user approval",
      "Headline price that excludes calibration or tax",
      "Unsupported or invented competitor claims",
    ],
  };
}
function event(n: NegotiationType, type: string, detail: string) {
  n.events.push({ eventId: id("evt"), type, detail, at: now() });
  n.updatedAt = now();
}
function get(idValue: string) {
  const n = store.negotiations[idValue];
  if (!n) throw new Error("negotiation not found");
  return n;
}
function latestOffersByProvider(n: NegotiationType) {
  const latest = new Map<string, NegotiationType["offers"][number]>();
  for (const offer of n.offers) {
    const sourceCall = n.calls.find((call) => call.callId === offer.callId);
    if (sourceCall && !sourceCall.isActiveAttempt) continue;
    const prior = latest.get(offer.providerId);
    if (!prior || offer.offerVersion > prior.offerVersion)
      latest.set(offer.providerId, offer);
  }
  return [...latest.values()];
}
function runView(n: NegotiationType): RunView {
  return {
    ...structuredClone(n),
    ranking: rankQuotes(latestOffersByProvider(n)),
  };
}

export function createNegotiation(input: unknown) {
  const intake = Intake.parse(input);
  const b = benchmark();
  const createdAt = now();
  const n: NegotiationType = {
    negotiationId: id("neg"),
    mode: "SANDBOX",
    state: "intake",
    intake,
    benchmark: b,
    benchmarkContext: null,
    strategy: strategyFor(intake, b),
    approvals: [],
    calls: [],
    providers: [],
    evidence: [],
    verifiedFacts: [],
    policyDecisions: [],
    quoteScenarios: [],
    negotiationStrategy: null,
    offers: [],
    callIds: [],
    redFlags: [],
    recommendation: null,
    followUps: [],
    events: [],
    createdAt,
    updatedAt: createdAt,
  };
  event(n, "NEGOTIATION_CREATED", "Draft intake created");
  mutate((s) => {
    s.negotiations[n.negotiationId] = n;
    s.currentNegotiationId = n.negotiationId;
  });
  return structuredClone(n);
}
export function createSandboxNegotiation(
  input: unknown,
  providerInput: Provider | Provider[],
  mode: "SANDBOX" | "REAL" = "SANDBOX",
) {
  const providers = Array.isArray(providerInput)
    ? providerInput
    : [providerInput];
  if (!providers.length)
    throw new Error("at least one provider is required");
  const request = SandboxIntake.parse(input),
    createdAt = now();
  const serviceText =
    request.damage.service === "NOT_SURE"
      ? "windshield repair or replacement assessment"
      : `windshield ${request.damage.service.toLowerCase()}`;
  const intake = Intake.parse({
    negotiationType: "auto_glass",
    objective: `Find the best ${serviceText} option`,
    currentSituation: `${request.damage.type.toLowerCase().replaceAll("_", " ")} damage at ${request.damage.location.toLowerCase().replaceAll("_", " ")}; ${request.damage.drivable ? "vehicle is drivable" : "vehicle is not drivable"}.`,
    priorities: ["safe complete service", "itemized all-in price", "warranty"],
    constraints: ["no booking without approval", "written confirmation"],
    desiredOutcomeMinor: null,
    walkAwayMinor: null,
    deadline: null,
    supportingContext: "",
    vehicle: {
      ...request.vehicle,
      frontCamera: request.features.includes("FRONT_CAMERA"),
    },
    damage: request.damage,
    features: request.features,
    postalCode: request.postalCode,
    insuranceInvolved: request.insuranceInvolved,
    schedulePreference: request.schedulePreference,
    sources: [
      { kind: "USER", label: `${mode === "REAL" ? "Authorized" : "Sandbox"} windshield intake`, addedAt: createdAt },
    ],
  });
  const b = benchmark();
  const n: NegotiationType = {
    negotiationId: id("neg"),
    mode,
    state: "calls_ready",
    intake,
    benchmark: b,
    strategy: strategyFor(intake, b),
    approvals: [
      {
        approvalId: id("approval"),
        action: "CONFIRM_SPEC",
        approved: true,
        details: "Confirmed by Find and call providers submission",
        createdAt,
      },
      {
        approvalId: id("approval"),
        action: "START_CALLS",
        approved: true,
        details: `${mode === "REAL" ? "Opted-in provider" : "Sandbox provider"} calls authorized by submission`,
        createdAt,
      },
    ],
    calls: [],
    providers,
    evidence: [],
    verifiedFacts: [],
    policyDecisions: [],
    benchmarkContext: null,
    quoteScenarios: [],
    negotiationStrategy: null,
    offers: [],
    callIds: [],
    redFlags: [],
    recommendation: null,
    followUps: [],
    events: [],
    createdAt,
    updatedAt: createdAt,
  };
  event(
    n,
    "NEGOTIATION_CREATED",
    "Sandbox intake submitted and provider calling authorized",
  );
  for (const provider of providers)
    event(
      n,
      "PROVIDER_DISCOVERED",
      `${provider.name} discovered from explicit sandbox configuration`,
    );
  mutate((s) => {
    s.negotiations[n.negotiationId] = n;
    s.currentNegotiationId = n.negotiationId;
  });
  return structuredClone(n);
}
export function applyBenchmarkContext(
  negotiationId: string,
  b: Benchmark,
  context: BenchmarkContext,
) {
  return mutate(() => {
    const n = get(negotiationId);
    n.benchmark = b;
    n.benchmarkContext = context;
    n.strategy = strategyFor(n.intake, b);
    event(
      n,
      "BENCHMARK_READY",
      `${b.sourceLabel}; ${b.classification.toLowerCase()} evidence only until local quotes qualify`,
    );
    return structuredClone(n);
  });
}
export async function createNegotiationFromVin(input: unknown) {
  const request = Intake.pick({
    objective: true,
    currentSituation: true,
    priorities: true,
    constraints: true,
    desiredOutcomeMinor: true,
    walkAwayMinor: true,
    deadline: true,
    supportingContext: true,
    postalCode: true,
  })
    .extend({ vin: z.string() })
    .parse(input);
  const decoded = await decodeVin(request.vin);
  return createNegotiation({
    ...request,
    negotiationType: "auto_glass",
    vehicle: {
      year: decoded.year,
      make: decoded.make,
      model: decoded.model,
      vin: decoded.vin,
      frontCamera: decoded.adasLikely,
    },
    sources: [
      { kind: "USER", label: "Negotiation preferences", addedAt: now() },
      {
        kind: "DOCUMENT",
        label: `${decoded.source.label}: ${decoded.adasEvidence.join("; ") || "vehicle identity only; ADAS not established"}`,
        addedAt: decoded.source.decodedAt,
      },
    ],
  });
}
export function addDocument(
  negotiationId: string,
  documentText: string,
  label = "Pasted quote or service document",
) {
  if (documentText.trim().length < 10)
    throw new Error("document text must contain at least 10 characters");
  return mutate(() => {
    const n = get(negotiationId);
    n.intake.supportingContext = [
      n.intake.supportingContext,
      documentText.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");
    n.intake.sources.push({ kind: "DOCUMENT", label, addedAt: now() });
    event(
      n,
      "DOCUMENT_ADDED",
      `${label}; content retained as user-provided evidence, not a verified benchmark`,
    );
    return structuredClone(n);
  });
}
export function recordApproval(
  negotiationId: string,
  action: NegotiationType["approvals"][number]["action"],
  details: string,
) {
  const current = get(negotiationId);
  if (
    action === "START_CALLS" &&
    !current.approvals.some((a) => a.action === "CONFIRM_SPEC")
  )
    throw new Error("confirm the specification before approving calls");
  return mutate(() => {
    const n = get(negotiationId);
    if (n.approvals.some((a) => a.action === action)) return structuredClone(n);
    n.approvals.push({
      approvalId: id("approval"),
      action,
      approved: true,
      details,
      createdAt: now(),
    });
    if (action === "CONFIRM_SPEC") n.state = "strategy_ready";
    if (action === "START_CALLS") n.state = "calls_ready";
    event(n, "APPROVAL_RECORDED", action);
    return structuredClone(n);
  });
}
export function assertCallsApproved(negotiationId: string) {
  const n = get(negotiationId);
  if (!n.approvals.some((a) => a.action === "START_CALLS"))
    throw new Error("explicit START_CALLS approval is required");
  return n;
}
export function recordCall(
  negotiationId: string,
  input: {
    callId: string;
    providerId: string;
    conversationId: string | null;
    twilioCallSid?: string | null;
    phase?: "QUOTE_COLLECTION" | "NEGOTIATION";
    status: "QUEUED" | "IN_PROGRESS" | "COMPLETE" | "FAILED";
    outcome: "QUOTED" | "CALLBACK_REQUIRED" | "DECLINED" | "DROPPED" | null;
    reason: string | null;
    startedAt?: string;
    endedAt?: string | null;
    attemptNumber?: number;
    supersedesCallId?: string | null;
    controllerMode?: "HOSTED_TOOLS" | "BACKEND_CUSTOM_LLM";
    deployment?: NegotiationType["calls"][number]["deployment"];
    transcript?: Array<{
      turnId?: string;
      role?: "agent" | "user";
      message?: string | null;
      text?: string | null;
      time_in_call_secs?: number;
    }>;
  },
) {
  return mutate(() => {
    const n = get(negotiationId),
      existing = n.calls.find((c) => c.callId === input.callId);
    const transcript = (input.transcript ?? []).flatMap((t, index) => {
      const text = t.message ?? t.text;
      return text
        ? [
            {
              turnId:
                t.turnId ?? `${input.conversationId ?? input.callId}_${index}`,
              speaker:
                t.role === "agent" ? ("AGENT" as const) : ("SHOP" as const),
              text,
              timeSeconds: t.time_in_call_secs ?? null,
            },
          ]
        : [];
    });
    const phase = input.phase ?? existing?.phase ?? ("QUOTE_COLLECTION" as const),
      priorAttempts = n.calls.filter((candidate) => candidate.providerId === input.providerId && candidate.phase === phase && candidate.callId !== input.callId),
      latestPrior = priorAttempts.sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
    if (!existing && latestPrior) latestPrior.isActiveAttempt = false;
    const call = {
      callId: input.callId,
      providerId: input.providerId,
      conversationId: input.conversationId ?? existing?.conversationId ?? null,
      twilioCallSid: input.twilioCallSid ?? existing?.twilioCallSid ?? null,
      phase,
      status: input.status,
      outcome: input.outcome,
      reason: input.reason,
      startedAt: input.startedAt ?? existing?.startedAt ?? now(),
      endedAt:
        input.endedAt ??
        (input.status === "QUEUED" || input.status === "IN_PROGRESS"
          ? null
          : now()),
      transcript: transcript.length ? transcript : (existing?.transcript ?? []),
      draft: existing?.draft ?? null,
      intelligence: existing?.intelligence ?? null,
      attemptNumber: input.attemptNumber ?? existing?.attemptNumber ?? ((latestPrior?.attemptNumber ?? 0) + 1),
      supersedesCallId: input.supersedesCallId ?? existing?.supersedesCallId ?? latestPrior?.callId ?? null,
      isActiveAttempt: existing?.isActiveAttempt ?? true,
      controllerMode: input.controllerMode ?? existing?.controllerMode ?? "HOSTED_TOOLS",
      deployment: input.deployment ?? existing?.deployment ?? null,
      consecutivePipelineFailures: existing?.consecutivePipelineFailures ?? 0,
      retentionPurgedAt: existing?.retentionPurgedAt ?? null,
    };
    const index = n.calls.findIndex((c) => c.callId === input.callId);
    if (index >= 0) n.calls[index] = call;
    else n.calls.push(call);
    if (!n.callIds.includes(input.callId)) n.callIds.push(input.callId);
    if (input.status === "QUEUED" || input.status === "IN_PROGRESS")
      n.state = "call_in_progress";
    else if (input.outcome === "CALLBACK_REQUIRED")
      n.state = "follow_up_required";
    else if (input.outcome === "QUOTED") n.state = "offer_received";
    else n.state = "calls_ready";
    event(
      n,
      "CALL_RECORDED",
      `${input.providerId}: ${input.outcome ?? input.status}`,
    );
    return structuredClone(n);
  });
}
export function findNegotiationByCallId(callId: string) {
  for (const n of Object.values(store.negotiations)) {
    if (n.calls.some((c) => c.callId === callId)) return n;
  }
  throw new Error("call not found");
}
export function getCallContext(callId: string, providerId?: string) {
  const n = findNegotiationByCallId(callId),
    call = n.calls.find((c) => c.callId === callId)!;
  if (providerId && call.providerId !== providerId)
    throw new Error("provider does not match call");
  const provider = n.providers.find((p) => p.providerId === call.providerId);
  if (!provider) throw new Error("provider not found for call");
  return { negotiation: n, call, provider };
}
export function getCallContextByConversationId(
  conversationId: string,
  providerId?: string,
) {
  for (const n of Object.values(store.negotiations)) {
    const call = n.calls.find((c) => c.conversationId === conversationId);
    if (!call) continue;
    if (providerId && call.providerId !== providerId)
      throw new Error("provider does not match conversation");
    const provider = n.providers.find((p) => p.providerId === call.providerId);
    if (!provider) throw new Error("provider not found for conversation");
    return { negotiation: n, call, provider };
  }
  throw new Error("conversation not found");
}
export function attachOffer(negotiationId: string, offerInput: unknown) {
  const offer = QuoteOffer.parse(offerInput);
  return mutate(() => {
    const n = assertCallsApproved(negotiationId);
    const others = n.offers
      .filter(
        (o) =>
          o.stage === "INITIAL" &&
          o.comparability === "COMPARABLE" &&
          o.totals.reconciliation === "MATCH" &&
          o.totals.statedAllInMinor != null,
      )
      .map((o) => o.totals.statedAllInMinor!);
    offer.redFlags = applyRedFlags(offer, others, n.intake.vehicle.frontCamera);
    n.offers.push(offer);
    if (!n.callIds.includes(offer.callId)) n.callIds.push(offer.callId);
    n.redFlags = n.offers.flatMap((o) =>
      o.redFlags.map((f) => ({
        code: f.code,
        severity:
          f.code.includes("OMITTED") || f.code.includes("MISMATCH")
            ? ("HIGH" as const)
            : ("MEDIUM" as const),
        detail: f.detail,
      })),
    );
    refreshBenchmark(n);
    n.state = "offer_received";
    event(
      n,
      "OFFER_RECORDED",
      `${offer.providerId} offer version ${offer.offerVersion}`,
    );
    return structuredClone(n);
  });
}
export function revalidateOffers(negotiationId: string) {
  return mutate(() => {
    const n = get(negotiationId);
    for (const offer of n.offers.filter((item) => item.stage === "INITIAL")) {
      const call = n.calls.find((item) => item.callId === offer.callId);
      if (call?.intelligence && !summarizeCallIntelligence(n, call).canClose) {
        offer.comparability = "NON_COMPARABLE";
        offer.totals.reconciliation = "NOT_COMPARABLE_YET";
      }
    }
    const eligibleProviders = new Set(
      n.offers
        .filter(
          (offer) =>
            offer.stage === "INITIAL" &&
            offer.comparability === "COMPARABLE" &&
            offer.totals.reconciliation === "MATCH",
        )
        .map((offer) => offer.providerId),
    );
    n.verifiedFacts = n.verifiedFacts.filter(
      (fact) =>
        fact.subjectProviderId != null &&
        eligibleProviders.has(fact.subjectProviderId),
    );
    return runView(n);
  });
}
export function prepareNegotiationStrategy(
  negotiationId: string,
  targetProviderId: string,
) {
  return mutate(() => {
    const n = get(negotiationId),
      initial = [...n.offers]
        .filter((offer) => offer.providerId === targetProviderId && offer.stage === "INITIAL" && offer.totals.statedAllInMinor != null)
        .sort((a, b) => b.offerVersion - a.offerVersion)[0],
      alternative = [...n.offers]
        .filter((offer) => offer.providerId !== targetProviderId && offer.stage === "INITIAL" && offer.comparability === "COMPARABLE" && offer.totals.reconciliation === "MATCH" && offer.totals.statedAllInMinor != null)
        .sort((a, b) => a.totals.statedAllInMinor! - b.totals.statedAllInMinor!)[0];
    if (!initial?.totals.statedAllInMinor) throw new Error("target provider has no initial offer");
    n.negotiationStrategy = {
      targetProviderId,
      initialOfferMinor: initial.totals.statedAllInMinor,
      bestVerifiedAlternativeMinor: alternative?.totals.statedAllInMinor ?? null,
      attemptedTactics: [],
      availableTactics: [
        "GENERAL_FLEXIBILITY",
        ...(alternative ? ["VERIFIED_PRICE_MATCH" as const] : []),
        "FEE_REDUCTION",
        ...(n.intake.schedulePreference ? ["SCHEDULE_TRADEOFF" as const] : []),
      ],
      maxAttempts: 3,
      finalResponse: false,
    };
    n.recommendation = null;
    n.state = "call_in_progress";
    event(n, "NEGOTIATION_STRATEGY_READY", `${targetProviderId}: ${n.negotiationStrategy.availableTactics.join(", ")}`);
    return structuredClone(n.negotiationStrategy);
  });
}
export function recommend(negotiationId: string) {
  return mutate(() => {
    const n = get(negotiationId),
      latestOffers = latestOffersByProvider(n),
      best = rankQuotes(latestOffers).find((r) => r.eligible),
      latest =
        latestOffers.find((o) => o.quoteId === best?.quoteId) ??
        latestOffers.at(-1);
    if (!latest?.totals.statedAllInMinor)
      throw new Error("at least one priced offer is required");
    const total = latest.totals.statedAllInMinor;
    let action: ActionRecommendation["action"] = "COUNTER";
    const reasons: string[] = [];
    if (
      latest.comparability !== "COMPARABLE" ||
      latest.totals.reconciliation !== "MATCH"
    ) {
      action = "CLARIFY";
      reasons.push(
        "The offer is not yet a reconciled, comparable all-in quote.",
      );
    } else if (
      latest.redFlags.some(
        (f) => f.code.includes("OMITTED") || f.code.includes("MISMATCH"),
      )
    ) {
      action = "CLARIFY";
      reasons.push("Resolve high-severity risks before deciding.");
    } else if (total > n.strategy.walkAwayMinor) {
      action = "WALK_AWAY";
      reasons.push("The offer exceeds the user's walk-away point.");
    } else if (total <= n.strategy.realisticTargetMinor) {
      action = "ACCEPT";
      reasons.push("The offer meets the approved realistic target.");
    } else {
      reasons.push(
        "The offer is inside the acceptable range but above target.",
      );
    }
    reasons.push(
      n.benchmark.classification === "VERIFIED"
        ? "Benchmark is derived from reconciled local quotes for this run."
        : `Benchmark is ${n.benchmark.classification.toLowerCase()} and is not verified market data.`,
    );
    const rec: ActionRecommendation = {
      action,
      offerId: latest.quoteId,
      summary:
        action === "ACCEPT"
          ? "Good candidate to accept after the user reviews final written terms."
          : action === "COUNTER"
            ? "Counter once using verified facts, then reassess."
            : action === "WALK_AWAY"
              ? "Do not proceed at this price."
              : "Clarify the scope and all-in total before deciding.",
      reasons,
      suggestedCounterMinor:
        action === "COUNTER" ? n.strategy.realisticTargetMinor : null,
      createdAt: now(),
    };
    n.recommendation = rec;
    n.state = "recommendation_ready";
    event(n, "RECOMMENDATION_CREATED", rec.action);
    return structuredClone(n);
  });
}
export function addFollowUp(
  negotiationId: string,
  input: { idempotencyKey: string; dueAt: string; note: string },
) {
  return mutate(() => {
    const n = get(negotiationId);
    const existing = n.followUps.find(
      (f) => f.idempotencyKey === input.idempotencyKey,
    );
    if (existing) return structuredClone(n);
    n.followUps.push({
      followUpId: id("followup"),
      idempotencyKey: input.idempotencyKey,
      dueAt: new Date(input.dueAt).toISOString(),
      note: input.note,
      status: "OPEN",
      createdAt: now(),
    });
    n.state = "follow_up_required";
    event(n, "FOLLOW_UP_CREATED", input.note);
    return structuredClone(n);
  });
}
export function closeNegotiation(
  negotiationId: string,
  outcome: "accepted" | "walked_away" | "closed",
) {
  return mutate(() => {
    const n = get(negotiationId);
    if (
      outcome === "accepted" &&
      !n.approvals.some((a) => a.action === "ACCEPT_OFFER")
    )
      throw new Error("explicit ACCEPT_OFFER approval is required");
    n.state = outcome;
    event(n, "NEGOTIATION_CLOSED", outcome);
    return structuredClone(n);
  });
}
export function getNegotiation(negotiationId: string): RunView {
  return runView(get(negotiationId));
}
export function currentNegotiation() {
  return store.currentNegotiationId
    ? getNegotiation(store.currentNegotiationId)
    : null;
}
export function parseNegotiation(value: unknown) {
  return Negotiation.parse(value);
}
