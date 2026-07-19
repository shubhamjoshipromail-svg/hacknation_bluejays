import { beforeEach, describe, expect, it } from "vitest";
import { createConversationController, type ControllerModels, type TurnExtraction } from "./conversation-controller.js";
import { createSandboxNegotiation, getCallContext, getNegotiation, recordCall } from "./negotiation-service.js";
import { resetStore } from "./store.js";

const provider = { providerId: "controller_shop", name: "Controller Shop", phoneNumber: "+15555550199", locationLabel: "Charlotte", source: "SANDBOX_CONFIG" as const, verified: true };
const intake = { vehicle: { year: 2022, make: "Honda", model: "CR-V", vin: null }, damage: { service: "REPLACEMENT" as const, type: "CRACK" as const, location: "CENTER" as const, drivable: true }, features: ["FRONT_CAMERA" as const], postalCode: "28202", insuranceInvolved: false, schedulePreference: null };
const emptyExtraction = (): TurnExtraction => ({ facts: [], providerIntent: "ANSWER", providerFinal: false, conditionalScenarios: [] });

function setup(models: ControllerModels) {
  const negotiation = createSandboxNegotiation(intake, provider);
  recordCall(negotiation.negotiationId, { callId: "call_controller", providerId: provider.providerId, conversationId: "conv_controller", status: "IN_PROGRESS", outcome: null, reason: null, controllerMode: "BACKEND_CUSTOM_LLM" });
  return { id: negotiation.negotiationId, controller: createConversationController({}, models) };
}

beforeEach(() => resetStore());

describe("backend conversation controller", () => {
  it("corrects a model that misclassifies explicit exclusion", async () => {
    const extraction: TurnExtraction = { ...emptyExtraction(), facts: [{ key: "ADAS_INCLUDED", status: "KNOWN", value: "included", amountMinor: null, itemStatus: "INCLUDED", confidence: 0.98, evidenceText: "ADAS is not included", scope: ["ADAS_CALIBRATION"], confirmedCorrection: false }] };
    const { id, controller } = setup({ extract: async () => extraction, verbalize: async ({ action }) => action.instruction });
    await controller.processTurn({ callId: "call_controller", providerId: provider.providerId, utterance: "ADAS is not included", messageIndex: 1 });
    const belief = getCallContext("call_controller").call.intelligence?.beliefs.find((item) => item.key === "ADAS_INCLUDED");
    expect(belief?.itemStatus).toBe("EXCLUDED");
  });

  it("deduplicates a retried provider turn", async () => {
    const { id, controller } = setup({ extract: async () => emptyExtraction(), verbalize: async ({ action }) => action.instruction });
    const input = { callId: "call_controller", providerId: provider.providerId, utterance: "The total is still unknown", messageIndex: 2 };
    await controller.processTurn(input);
    await controller.processTurn(input);
    expect(getNegotiation(id).calls[0].transcript.filter((turn) => turn.speaker === "SHOP")).toHaveLength(1);
  });

  it("asks for one repeat and then ends after consecutive pipeline failures", async () => {
    const { controller } = setup({ extract: async () => { throw new Error("extractor unavailable"); }, verbalize: async () => "unused" });
    const first = await controller.processTurn({ callId: "call_controller", providerId: provider.providerId, utterance: "hello", messageIndex: 1 });
    const second = await controller.processTurn({ callId: "call_controller", providerId: provider.providerId, utterance: "hello again", messageIndex: 2 });
    expect(first).toMatchObject({ type: "speech", action: { kind: "SAFE_FAIL" } });
    expect(second).toMatchObject({ type: "system_tool", name: "end_call", action: { outcome: "DROPPED" } });
  });
});
