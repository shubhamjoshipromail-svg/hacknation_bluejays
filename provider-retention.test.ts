import { beforeEach, describe, expect, it } from "vitest";
import { createSandboxNegotiation, getNegotiation, recordCall } from "./negotiation-service.js";
import { eligibleRealProviders, registerOptedInProvider, revokeProviderConsent } from "./provider-consent-service.js";
import { purgeExpiredCallEvidence } from "./retention-service.js";
import { resetStore } from "./store.js";

beforeEach(() => resetStore());

describe("real-provider consent and retention", () => {
  it("only returns active North Carolina opt-ins", () => {
    const provider = registerOptedInProvider({ name: "Pilot Glass", phoneNumber: "+17045550123", locationLabel: "Charlotte, NC", jurisdiction: "NC", consentSource: "signed pilot agreement", consentCapturedAt: "2026-07-01T00:00:00.000Z", consentExpiresAt: null, consentEvidenceRef: "agreement-42" });
    expect(eligibleRealProviders(new Date("2026-07-19T00:00:00.000Z"))).toHaveLength(1);
    revokeProviderConsent(provider.providerId, "provider requested removal");
    expect(eligibleRealProviders(new Date("2026-07-19T00:00:00.000Z"))).toHaveLength(0);
  });

  it("purges transcript text after thirty days while retaining call metadata", () => {
    const provider = { providerId: "retention_shop", name: "Retention Shop", phoneNumber: "+15555550200", locationLabel: "NC", source: "SANDBOX_CONFIG" as const, verified: true };
    const n = createSandboxNegotiation({ vehicle: { year: 2020, make: "Ford", model: "Escape", vin: null }, damage: { service: "REPLACEMENT" as const, type: "CRACK" as const, location: "CENTER" as const, drivable: true }, features: [], postalCode: "28202", insuranceInvolved: false, schedulePreference: null }, provider);
    recordCall(n.negotiationId, { callId: "old_call", providerId: provider.providerId, conversationId: "old_conv", status: "COMPLETE", outcome: "DROPPED", reason: "test", endedAt: "2026-06-01T00:00:00.000Z", transcript: [{ turnId: "old_turn", role: "user", message: "sensitive transcript" }] });
    expect(purgeExpiredCallEvidence(new Date("2026-07-19T00:00:00.000Z"), 30).purgedCalls).toBe(1);
    expect(getNegotiation(n.negotiationId).calls[0]).toMatchObject({ callId: "old_call", transcript: [], retentionPurgedAt: "2026-07-19T00:00:00.000Z" });
  });
});
