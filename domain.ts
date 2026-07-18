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
