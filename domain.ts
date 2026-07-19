/**
 * Immutable integration contract. Money is always integer cents.
 */
import { z } from "zod";

export const Money = z.number().int().nonnegative();
export const Sha256 = z.string().length(64);
export const IsoDate = z.string().datetime();
export const Knowable = <T extends z.ZodTypeAny>(inner: T) => z.union([inner, z.literal("UNKNOWN")]);

export const ProvenanceAnchor = z.object({
  provenanceId: z.string(), conversationId: z.string(), turnId: z.string(),
  speaker: z.enum(["PROVIDER", "BUYER_AGENT", "USER"]), startMs: z.number().int().optional(), endMs: z.number().int().optional(),
  transcriptExcerpt: z.string(), claimType: z.enum(["PRICE_LINE_ITEM", "TOTAL", "TERM", "SPEC_FIELD", "STATEMENT"]),
  extractionMethod: z.enum(["LIVE_TOOL", "POST_CALL_EXTRACTION", "LIVE_TOOL_CONFIRMED_POST_CALL", "USER_INPUT", "DOCUMENT_OCR"]),
  confidence: z.number().min(0).max(1),
});
export type ProvenanceAnchor = z.infer<typeof ProvenanceAnchor>;

export const AutoGlassSpecCore = z.object({
  purchaseMode: z.literal("CASH_PAY"),
  vehicle: z.object({ vin: z.string().length(17), vinVerification: z.enum(["CHECKSUM_ONLY", "CHECKSUM_AND_DECODED", "UNVERIFIED"]), year: z.number().int(), make: z.string(), model: z.string(), trim: Knowable(z.string()), adasFeatures: z.array(z.enum(["FRONT_CAMERA", "RAIN_SENSOR", "HEATED_GLASS", "HUD"])) }),
  damage: z.object({ service: z.literal("WINDSHIELD_REPLACEMENT"), drivable: z.boolean() }),
  requirements: z.object({ glassPreference: z.enum(["OEM_ONLY", "AFTERMARKET_EQUIVALENT_ACCEPTABLE"]), calibrationRequired: Knowable(z.enum(["YES", "NO"])), serviceMode: z.array(z.enum(["MOBILE", "IN_SHOP"])), warrantyRequired: z.boolean() }),
  serviceArea: z.object({ postalCode: z.string(), exactAddressDisclosure: z.literal("AFTER_SELECTION") }),
  schedule: z.object({ windows: z.array(z.string()), flexible: z.boolean() }),
  authorization: z.object({ mayGatherQuotes: z.literal(true), mayUseVerifiedCompetitorOffer: z.boolean(), mayBook: z.literal(false), maximumTotalMinor: Money.nullable() }),
  unknowns: z.array(z.string()),
});
export const JobSpec = z.object({ specId: z.string(), revision: z.number().int().positive(), vertical: z.enum(["auto_glass", "junk_removal"]), status: z.enum(["DRAFT", "CONFIRMED"]), core: AutoGlassSpecCore, callBrief: z.object({ text: z.string(), sha256: Sha256 }).nullable(), confirmation: z.object({ confirmedBy: z.string(), confirmedAt: IsoDate, coreSha256: Sha256 }).nullable() });
export type JobSpec = z.infer<typeof JobSpec>;

export const FeeCategory = z.enum(["BASE_GLASS_AND_INSTALL", "ADAS_CALIBRATION", "MOBILE_SERVICE", "MOLDINGS_CLIPS_SENSOR_KIT", "DISPOSAL_ENVIRONMENTAL", "SHOP_SUPPLIES", "TAX", "DISCOUNT", "OTHER"]);
export type FeeCategory = z.infer<typeof FeeCategory>;
export const LineItemStatus = z.enum(["INCLUDED", "EXCLUDED", "NOT_APPLICABLE", "UNKNOWN"]);
export const QuoteLineItem = z.object({ category: FeeCategory, rawLabel: z.string(), amountMinor: Money.nullable(), status: LineItemStatus, scope: z.record(z.string(), z.string()).default({}), provenanceIds: z.array(z.string()).min(1) });
export type QuoteLineItem = z.infer<typeof QuoteLineItem>;
export const QuoteOffer = z.object({
  quoteId: z.string(), providerId: z.string(), callId: z.string(), specRevision: z.number().int(), offerVersion: z.number().int().positive(), stage: z.enum(["INITIAL", "NEGOTIATED"]), currency: z.literal("USD"), lineItems: z.array(QuoteLineItem),
  totals: z.object({ statedAllInMinor: Money.nullable(), computedKnownMinor: Money, taxStatus: z.enum(["INCLUDED", "EXCLUDED", "UNKNOWN"]), reconciliation: z.enum(["MATCH", "TOTAL_MISMATCH", "NOT_COMPARABLE_YET"]) }),
  terms: z.object({ validUntil: IsoDate.nullable(), writtenConfirmation: z.boolean(), warranty: Knowable(z.string()), appointmentWindow: Knowable(z.string()) }),
  comparability: z.enum(["COMPARABLE", "CONDITIONALLY_COMPARABLE", "NON_COMPARABLE"]), redFlags: z.array(z.object({ code: z.string(), detail: z.string() })),
});
export type QuoteOffer = z.infer<typeof QuoteOffer>;
export const CallOutcome = z.object({ callId: z.string(), providerId: z.string(), outcome: z.enum(["QUOTED", "CALLBACK_REQUIRED", "DECLINED", "DROPPED"]), reason: z.string(), quoteId: z.string().nullable(), callbackWindow: z.string().nullable(), endedAt: IsoDate });
export type CallOutcome = z.infer<typeof CallOutcome>;
export const VerifiedFact = z.object({ factId: z.string(), kind: z.enum(["COMPETITOR_ALL_IN_OFFER", "EXISTING_WRITTEN_QUOTE", "USER_SCHEDULE_FLEXIBILITY", "USER_SERVICE_MODE_TRADEOFF"]), subjectProviderId: z.string().nullable(), amountMinor: Money.nullable(), scopeHash: Sha256, validUntil: IsoDate.nullable(), provenanceIds: z.array(z.string()).min(1), allowedClaim: z.string(), status: z.enum(["ACTIVE", "EXPIRED", "REVOKED"]) });
export type VerifiedFact = z.infer<typeof VerifiedFact>;
export const PolicyDecision = z.object({ decisionId: z.string(), callId: z.string(), requested: z.string(), decision: z.enum(["ALLOW", "DENY"]), factIds: z.array(z.string()), allowedStatement: z.string().nullable(), denyReason: z.string().nullable(), round: z.number().int().min(1).max(3), at: IsoDate });
export type PolicyDecision = z.infer<typeof PolicyDecision>;
export const Recommendation = z.object({ runId: z.string(), ranked: z.array(z.object({ quoteId: z.string(), eligible: z.boolean(), ineligibleReason: z.string().nullable(), score: z.number().nullable(), componentScores: z.record(z.string(), z.number()).nullable(), visiblePenalties: z.array(z.string()) })), bestValueQuoteId: z.string().nullable(), cheapestComparableQuoteId: z.string().nullable(), verifiedSavingsMinor: Money.nullable(), explanationProse: z.string() });
export type Recommendation = z.infer<typeof Recommendation>;

export const NegotiationState = z.enum([
  "intake", "awaiting_user_approval", "strategy_ready", "calls_ready",
  "call_in_progress", "offer_received", "recommendation_ready",
  "follow_up_required", "accepted", "walked_away", "closed",
]);
export type NegotiationState = z.infer<typeof NegotiationState>;

export const Intake = z.object({
  negotiationType: z.literal("auto_glass"),
  objective: z.string().min(3).max(500),
  currentSituation: z.string().min(3).max(2_000),
  priorities: z.array(z.string().min(1)).min(1).max(6),
  constraints: z.array(z.string().min(1)).max(6).default([]),
  desiredOutcomeMinor: Money.nullable(),
  walkAwayMinor: Money.nullable(),
  deadline: IsoDate.nullable().default(null),
  supportingContext: z.string().max(5_000).default(""),
  vehicle: z.object({ year: z.number().int().min(1980).max(2100), make: z.string().min(1), model: z.string().min(1), vin: z.string().length(17).nullable().default(null), frontCamera: z.boolean().default(false) }),
  damage: z.object({
    service: z.enum(["REPAIR", "REPLACEMENT", "NOT_SURE"]).default("NOT_SURE"),
    type: z.enum(["CHIP", "CRACK", "SHATTERED", "OTHER", "NOT_SURE"]).default("NOT_SURE"),
    location: z.enum(["DRIVER_SIDE", "PASSENGER_SIDE", "CENTER", "EDGE", "MULTIPLE", "NOT_SURE"]).default("NOT_SURE"),
    drivable: z.boolean().default(true),
  }).default({}),
  features: z.array(z.enum(["FRONT_CAMERA", "RAIN_SENSOR", "HEATED_GLASS", "HUD", "NOT_SURE"])).default([]),
  insuranceInvolved: z.boolean().default(false),
  schedulePreference: z.string().max(500).nullable().default(null),
  postalCode: z.string().regex(/^\d{5}$/),
  sources: z.array(z.object({ kind: z.enum(["USER", "VOICE_INTERVIEW", "DOCUMENT"]), label: z.string(), addedAt: IsoDate })),
});
export type Intake = z.infer<typeof Intake>;

export const SandboxIntake = z.object({
  vehicle: z.object({
    year: z.number().int().min(1980).max(2100),
    make: z.string().trim().min(1).max(100),
    model: z.string().trim().min(1).max(100),
    vin: z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/).nullable().default(null),
  }),
  damage: z.object({
    service: z.enum(["REPAIR", "REPLACEMENT", "NOT_SURE"]),
    type: z.enum(["CHIP", "CRACK", "SHATTERED", "OTHER", "NOT_SURE"]),
    location: z.enum(["DRIVER_SIDE", "PASSENGER_SIDE", "CENTER", "EDGE", "MULTIPLE", "NOT_SURE"]),
    drivable: z.boolean().default(true),
  }),
  features: z.array(z.enum(["FRONT_CAMERA", "RAIN_SENSOR", "HEATED_GLASS", "HUD", "NOT_SURE"])).default([]),
  postalCode: z.string().regex(/^\d{5}$/),
  insuranceInvolved: z.boolean().default(false),
  schedulePreference: z.string().trim().max(500).nullable().default(null),
});
export type SandboxIntake = z.infer<typeof SandboxIntake>;

export const CallFactKey = z.enum([
  "SERVICE_RECOMMENDATION", "BASE_PRICE", "TOTAL", "ALL_IN_SCOPE", "TAX",
  "ADAS_INCLUDED", "ADAS_TYPE", "ADAS_PRICE", "GLASS_TYPE", "MOBILE_SERVICE",
  "MOLDINGS_CLIPS_SENSOR_KIT", "DISPOSAL_ENVIRONMENTAL", "SHOP_SUPPLIES",
  "WARRANTY", "AVAILABILITY", "WRITTEN_CONFIRMATION", "PRICE_CHANGE_CONDITIONS",
  "REPRESENTATIVE", "CALLBACK", "QUOTE_REFERENCE", "QUOTE_VALIDITY",
]);
export type CallFactKey = z.infer<typeof CallFactKey>;
export const CallFactStatus = z.enum(["KNOWN", "NOT_APPLICABLE", "REFUSED", "AMBIGUOUS"]);
export const CallIntelligenceFact = z.object({
  key: CallFactKey,
  status: CallFactStatus,
  value: z.string().nullable().default(null),
  amountMinor: Money.nullable().default(null),
  itemStatus: LineItemStatus.nullable().default(null),
  provenanceIds: z.array(z.string()).default([]),
  updatedAt: IsoDate,
});
export type CallIntelligenceFact = z.infer<typeof CallIntelligenceFact>;
export const CallContradiction = z.object({
  contradictionId: z.string(), key: CallFactKey, previousValue: z.string(), proposedValue: z.string(),
  resolved: z.boolean(), createdAt: IsoDate, resolvedAt: IsoDate.nullable(),
});
export type CallContradiction = z.infer<typeof CallContradiction>;
export const CallIntelligence = z.object({
  facts: z.array(CallIntelligenceFact).default([]),
  askedTopics: z.array(CallFactKey).default([]),
  contradictions: z.array(CallContradiction).default([]),
  lastProviderTurnId: z.string().nullable().default(null),
  criticalGaps:z.array(CallFactKey).default([]),optionalGaps:z.array(CallFactKey).default([]),
  completionStatus:z.enum(["NOT_QUOTABLE","NEEDS_ONE_CLARIFICATION","USABLE_BUT_INCOMPLETE","READY_TO_CLOSE"]).default("NOT_QUOTABLE"),
  canClose:z.boolean().default(false),
  updatedAt: IsoDate,
});
export type CallIntelligence = z.infer<typeof CallIntelligence>;

export const BenchmarkEvidence = z.object({
  signalId:z.string(),kind:z.string(),label:z.string(),lowMinor:Money,typicalMinor:Money.nullable(),highMinor:Money,
  strength:z.enum(["PRIMARY","AUTHORITATIVE_DIRECTIONAL","DIRECTIONAL"]),publisher:z.string(),url:z.string(),excerpt:z.string(),
});
export const BenchmarkContext = z.object({
  schemaVersion:z.literal("1.0"),generatedAt:IsoDate,expectedRangeMinor:z.tuple([Money,Money]).nullable(),
  requiredQuestions:z.array(z.string()),warnings:z.array(z.string()),evidence:z.array(BenchmarkEvidence),
  liveQuoteSampleSize:z.number().int().nonnegative(),
});
export type BenchmarkContext = z.infer<typeof BenchmarkContext>;

export const Benchmark = z.object({
  lowMinor: Money, typicalMinor: Money, highMinor: Money,
  classification: z.enum(["VERIFIED", "ESTIMATED", "AI_GENERATED"]),
  sourceLabel: z.string(), notes: z.array(z.string()), generatedAt: IsoDate,
});
export type Benchmark = z.infer<typeof Benchmark>;

export const Strategy = z.object({
  objective: z.string(), realisticTargetMinor: Money, openingPositionMinor: Money,
  acceptableMinMinor: Money, acceptableMaxMinor: Money, walkAwayMinor: Money,
  keyArguments: z.array(z.string()), questions: z.array(z.string()),
  likelyObjections: z.array(z.string()), suggestedResponses: z.array(z.string()),
  offerConcessions: z.array(z.string()), requestConcessions: z.array(z.string()), risksToAvoid: z.array(z.string()),
});
export type Strategy = z.infer<typeof Strategy>;

export const ActionRecommendation = z.object({
  action: z.enum(["ACCEPT", "COUNTER", "CLARIFY", "DELAY", "ESCALATE", "WALK_AWAY"]),
  offerId: z.string().nullable(), summary: z.string(), reasons: z.array(z.string()),
  suggestedCounterMinor: Money.nullable(), createdAt: IsoDate,
});
export type ActionRecommendation = z.infer<typeof ActionRecommendation>;

export const Approval = z.object({
  approvalId: z.string(), action: z.enum(["CONFIRM_SPEC", "START_CALLS", "MAKE_COUNTEROFFER", "ACCEPT_OFFER", "SHARE_SENSITIVE_INFO", "CONFIRM_AGREEMENT"]),
  approved: z.literal(true), details: z.string(), createdAt: IsoDate,
});
export const FollowUp = z.object({ followUpId: z.string(), idempotencyKey: z.string(), dueAt: IsoDate, note: z.string().min(1), status: z.enum(["OPEN", "DONE"]), createdAt: IsoDate });
export const NegotiationEvent = z.object({ eventId: z.string(), type: z.string(), detail: z.string(), at: IsoDate });
export const Provider = z.object({
  providerId: z.string(),
  name: z.string(),
  phoneNumber: z.string(),
  locationLabel: z.string(),
  source: z.literal("SANDBOX_CONFIG"),
  verified: z.boolean(),
});
export type Provider = z.infer<typeof Provider>;

export const NegotiationCall = z.object({
  callId:z.string(),providerId:z.string(),conversationId:z.string().nullable(),twilioCallSid:z.string().nullable().default(null),
  phase:z.enum(["QUOTE_COLLECTION","NEGOTIATION"]).default("QUOTE_COLLECTION"),
  status:z.enum(["QUEUED","IN_PROGRESS","COMPLETE","FAILED"]),
  outcome:z.enum(["QUOTED","CALLBACK_REQUIRED","DECLINED","DROPPED"]).nullable(),reason:z.string().nullable(),startedAt:IsoDate,endedAt:IsoDate.nullable(),
  transcript:z.array(z.object({turnId:z.string(),speaker:z.enum(["AGENT","SHOP"]),text:z.string(),timeSeconds:z.number().nonnegative().nullable()})),
  draft:z.object({lineItems:z.array(QuoteLineItem),statedTotalMinor:Money.nullable(),terms:z.record(z.string(),z.unknown())}).nullable().default(null),
  intelligence:CallIntelligence.nullable().default(null),
});
export type NegotiationCall = z.infer<typeof NegotiationCall>;

export const Negotiation = z.object({
  negotiationId: z.string(), mode:z.literal("SANDBOX").default("SANDBOX"), state: NegotiationState, intake: Intake,
  benchmark: Benchmark, strategy: Strategy, approvals: z.array(Approval), calls:z.array(NegotiationCall).default([]),
  providers:z.array(Provider).default([]), evidence:z.array(ProvenanceAnchor).default([]), verifiedFacts:z.array(VerifiedFact).default([]), policyDecisions:z.array(PolicyDecision).default([]),
  benchmarkContext:BenchmarkContext.nullable().default(null),
  offers: z.array(QuoteOffer), callIds: z.array(z.string()), redFlags: z.array(z.object({ code: z.string(), severity: z.enum(["LOW", "MEDIUM", "HIGH"]), detail: z.string() })),
  recommendation: ActionRecommendation.nullable(), followUps: z.array(FollowUp), events: z.array(NegotiationEvent),
  createdAt: IsoDate, updatedAt: IsoDate,
});
export type Negotiation = z.infer<typeof Negotiation>;
