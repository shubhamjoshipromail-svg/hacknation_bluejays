import { createHash, randomUUID } from "node:crypto";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { CallFactKey, CallFactStatus, LineItemStatus, type Negotiation, type NegotiationCall, type ProvenanceAnchor } from "./domain.js";
import { applyProviderObservation, summarizeCallIntelligence, type ObservationFactInput } from "./call-intelligence.js";
import { getCallContext } from "./negotiation-service.js";
import { requestLeverage } from "./policy.js";
import { mutate } from "./store.js";

const Extraction = z.object({
  facts: z.array(z.object({
    key: CallFactKey,
    status: CallFactStatus,
    value: z.string().nullable(),
    amountMinor: z.number().int().nonnegative().nullable(),
    itemStatus: LineItemStatus.nullable(),
    confidence: z.number().min(0).max(1),
    evidenceText: z.string(),
    scope: z.array(z.string()),
    confirmedCorrection: z.boolean(),
  })),
  providerIntent: z.enum(["ANSWER", "QUESTION", "HOLD", "REFUSAL", "OPT_OUT", "GOODBYE", "OTHER"]),
  providerFinal: z.boolean(),
  conditionalScenarios: z.array(z.object({
    label: z.string(),
    condition: z.string(),
    totalMinor: z.number().int().nonnegative(),
    includedCategories: z.array(z.enum(["BASE_GLASS_AND_INSTALL", "ADAS_CALIBRATION", "MOBILE_SERVICE", "MOLDINGS_CLIPS_SENSOR_KIT", "DISPOSAL_ENVIRONMENTAL", "SHOP_SUPPLIES", "TAX", "DISCOUNT", "OTHER"])),
    excludedCategories: z.array(z.enum(["BASE_GLASS_AND_INSTALL", "ADAS_CALIBRATION", "MOBILE_SERVICE", "MOLDINGS_CLIPS_SENSOR_KIT", "DISPOSAL_ENVIRONMENTAL", "SHOP_SUPPLIES", "TAX", "DISCOUNT", "OTHER"])),
    confidence: z.number().min(0).max(1),
    evidenceText: z.string(),
  })),
});
export type TurnExtraction = z.infer<typeof Extraction>;

const PlannedSpeech = z.object({ spokenResponse: z.string().min(1).max(500) });
export type ControllerAction = {
  kind: "ASK" | "CLARIFY" | "CONFIRM" | "NEGOTIATE" | "WAIT" | "CLOSE" | "SAFE_FAIL";
  instruction: string;
  outcome?: "QUOTED" | "CALLBACK_REQUIRED" | "DECLINED" | "DROPPED";
  allowedStatement?: string | null;
};
export type ControllerResult =
  | { type: "speech"; text: string; action: ControllerAction }
  | { type: "system_tool"; name: "end_call" | "skip_turn"; arguments: Record<string, string>; action: ControllerAction };

export type ControllerModels = {
  extract(input: { utterance: string; phase: NegotiationCall["phase"]; knownState: unknown }): Promise<TurnExtraction>;
  verbalize(input: { action: ControllerAction; utterance: string; state: unknown }): Promise<string>;
};

const QUESTIONS: Record<string, string> = {
  SERVICE_RECOMMENDATION: "Based on the damage, do you recommend repair or replacement?",
  BASE_PRICE: "What is the glass-and-installation amount before any separate fees?",
  TOTAL: "What is the confirmed all-in cash total?",
  ALL_IN_SCOPE: "Which services and fees are included in that total?",
  TAX: "Is tax included in that total?",
  ADAS_INCLUDED: "Does it require camera calibration, and is that included?",
  ADAS_TYPE: "Would the calibration be static, dynamic, or both?",
  ADAS_PRICE: "What amount applies to calibration?",
  GLASS_TYPE: "Is the quoted glass OEM, OEE, or aftermarket?",
};
const questionFor = (key: string) => QUESTIONS[key] ?? `Could you clarify ${key.toLowerCase().replaceAll("_", " ")}?`;

function openAiModels(env: NodeJS.ProcessEnv): ControllerModels {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const extractorModel = env.OPENAI_EXTRACTOR_MODEL ?? "gpt-5.6-luna";
  const plannerModel = env.OPENAI_PLANNER_MODEL ?? "gpt-5.6-terra";
  return {
    async extract({ utterance, phase, knownState }) {
      const response = await client.responses.parse({
        model: extractorModel,
        reasoning: { effort: "low" },
        store: false,
        input: [
          { role: "system", content: `Extract only explicit provider facts from the latest utterance for a ${phase} auto-glass call. Preserve negation: not included, separate, without, or additional must be EXCLUDED, never INCLUDED. A global phrase such as everything is included does not establish a named category unless the utterance names it. Amounts are integer US cents. Evidence text must be an exact substring. Return no fact when unsupported.` },
          { role: "user", content: JSON.stringify({ utterance, knownState }) },
        ],
        text: { format: zodTextFormat(Extraction, "provider_turn_extraction") },
      });
      if (!response.output_parsed) throw new Error("extractor returned no parsed output");
      return response.output_parsed;
    },
    async verbalize({ action, utterance, state }) {
      const response = await client.responses.parse({
        model: plannerModel,
        reasoning: { effort: "low" },
        store: false,
        input: [
          { role: "system", content: "Write one brief, natural spoken response for a busy auto-glass provider. Follow the supplied action exactly. Do not add prices, facts, leverage, promises, booking, or extra questions. Ask at most one question." },
          { role: "user", content: JSON.stringify({ action, providerUtterance: utterance, state }) },
        ],
        text: { format: zodTextFormat(PlannedSpeech, "planned_speech") },
      });
      if (!response.output_parsed) throw new Error("planner returned no parsed output");
      return response.output_parsed.spokenResponse;
    },
  };
}

function exactEvidenceFacts(utterance: string, extraction: TurnExtraction): ObservationFactInput[] {
  return extraction.facts.flatMap((fact) => {
    if (!fact.evidenceText || !utterance.toLowerCase().includes(fact.evidenceText.toLowerCase())) return [];
    const negated = /\b(not included|excluded|without|additional|separate)\b/i.test(fact.evidenceText);
    const itemStatus = negated ? "EXCLUDED" as const : fact.itemStatus;
    return [{
      key: fact.key,
      status: fact.status,
      value: fact.value,
      amountMinor: fact.amountMinor,
      itemStatus,
      confidence: fact.confidence,
      scope: fact.scope,
      confirmedCorrection: fact.confirmedCorrection,
    }];
  });
}

function mergeScenarios(callId: string, turnIdValue: string, utterance: string, extraction: TurnExtraction) {
  const { negotiation, call } = getCallContext(callId);
  for (const scenario of extraction.conditionalScenarios) {
    if (!utterance.toLowerCase().includes(scenario.evidenceText.toLowerCase())) continue;
    const scenarioId = `scenario_${createHash("sha256").update(`${callId}:${scenario.label}:${scenario.condition}:${scenario.totalMinor}`).digest("hex").slice(0, 16)}`;
    const adasRequired = negotiation.intake.vehicle.frontCamera || negotiation.intake.features.includes("NOT_SURE");
    const excludesRequiredAdas = adasRequired && scenario.excludedCategories.includes("ADAS_CALIBRATION");
    const taxStatus = scenario.includedCategories.includes("TAX") ? "INCLUDED" as const : scenario.excludedCategories.includes("TAX") ? "EXCLUDED" as const : "UNKNOWN" as const;
    const readiness = excludesRequiredAdas || taxStatus !== "INCLUDED" ? "CONDITIONALLY_COMPARABLE" as const : "COMPARABLE" as const;
    const existing = negotiation.quoteScenarios.find((item) => item.scenarioId === scenarioId);
    const value = { scenarioId, providerId: call.providerId, callId, attemptNumber: call.attemptNumber, label: scenario.label, conditions: [scenario.condition], totalMinor: scenario.totalMinor, taxStatus, includedCategories: scenario.includedCategories, excludedCategories: scenario.excludedCategories, confidence: scenario.confidence, evidenceTurnIds: [turnIdValue], readiness, active: call.isActiveAttempt };
    if (existing) Object.assign(existing, value, { evidenceTurnIds: [...new Set([...existing.evidenceTurnIds, turnIdValue])] });
    else negotiation.quoteScenarios.push(value);
  }
}

function safeSpeech(text: string, action: ControllerAction) {
  const forbidden = /\b(book(?:ed|ing)?|purchase|pay(?:ment)?|accept(?:ed)? on your behalf)\b/i;
  if (forbidden.test(text)) throw new Error("planner proposed a prohibited commitment");
  if (action.allowedStatement && action.kind === "NEGOTIATE" && !text.includes(action.allowedStatement))
    throw new Error("planner altered authorized leverage");
  return text.trim();
}

function chooseNegotiationAction(negotiation: Negotiation, call: NegotiationCall, extraction: TurnExtraction): ControllerAction {
  const strategy = negotiation.negotiationStrategy;
  if (!strategy || strategy.targetProviderId !== call.providerId)
    return { kind: "CLOSE", instruction: "End because no authorized negotiation strategy is active.", outcome: "DROPPED" };
  if (extraction.providerIntent === "OPT_OUT")
    return { kind: "CLOSE", instruction: "Acknowledge the opt-out and end immediately.", outcome: "DECLINED" };
  if (extraction.providerIntent === "HOLD") return { kind: "WAIT", instruction: "Wait silently." };
  const revisedTotal = call.draft?.statedTotalMinor;
  if (revisedTotal != null && revisedTotal < strategy.initialOfferMinor) {
    call.draft!.terms.negotiation_revised_total = revisedTotal;
    if (!call.draft!.terms.negotiation_confirmation_requested) {
      call.draft!.terms.negotiation_confirmation_requested = true;
      return { kind: "CONFIRM", instruction: `Confirm that $${(revisedTotal / 100).toFixed(2)} is the final all-in total with the same required scope.` };
    }
    strategy.finalResponse = true;
    return { kind: "CLOSE", instruction: "Thank them for confirming the improved all-in offer and end.", outcome: "QUOTED" };
  }
  if (extraction.providerIntent === "GOODBYE" || extraction.providerFinal || strategy.attemptedTactics.length >= strategy.maxAttempts) {
    strategy.finalResponse = true;
    return { kind: "CLOSE", instruction: "Thank them briefly and end without forcing another round.", outcome: "DECLINED" };
  }
  const remaining = strategy.availableTactics.filter((tactic) => !strategy.attemptedTactics.includes(tactic));
  const tactic = remaining.includes("GENERAL_FLEXIBILITY")
    ? "GENERAL_FLEXIBILITY"
    : extraction.facts.some((fact) => ["MOBILE_SERVICE", "SHOP_SUPPLIES", "DISPOSAL_ENVIRONMENTAL"].includes(fact.key)) && remaining.includes("FEE_REDUCTION")
      ? "FEE_REDUCTION"
      : remaining.includes("VERIFIED_PRICE_MATCH")
        ? "VERIFIED_PRICE_MATCH"
        : remaining[0];
  if (!tactic) return { kind: "CLOSE", instruction: "Thank them and end; no useful authorized tactic remains.", outcome: "DECLINED" };
  strategy.attemptedTactics.push(tactic);
  if (tactic === "VERIFIED_PRICE_MATCH") {
    const decision = requestLeverage({ callId: call.callId, targetProviderId: call.providerId, desiredConcession: "PRICE_MATCH", round: strategy.attemptedTactics.length }, negotiation.verifiedFacts, strategy.attemptedTactics.length - 1);
    negotiation.policyDecisions.push(decision);
    if (decision.decision === "ALLOW" && decision.allowedStatement)
      return { kind: "NEGOTIATE", instruction: `State this sentence exactly, then ask whether they can match or improve it: ${decision.allowedStatement}`, allowedStatement: decision.allowedStatement };
    return { kind: "NEGOTIATE", instruction: "Ask generally whether there is any flexibility. Do not mention another quote.", allowedStatement: null };
  }
  if (tactic === "FEE_REDUCTION") return { kind: "NEGOTIATE", instruction: "Ask whether any separate mobile, supply, or service fee can be reduced or waived.", allowedStatement: null };
  if (tactic === "SCHEDULE_TRADEOFF") return { kind: "NEGOTIATE", instruction: "Offer flexible weekday or in-shop scheduling only if it lowers the all-in total.", allowedStatement: null };
  return { kind: "NEGOTIATE", instruction: "Ask whether there is any flexibility in the all-in price.", allowedStatement: null };
}

function chooseAction(negotiation: Negotiation, call: NegotiationCall, state: ReturnType<typeof summarizeCallIntelligence>, extraction: TurnExtraction): ControllerAction {
  if (call.phase === "NEGOTIATION") return chooseNegotiationAction(negotiation, call, extraction);
  if (extraction.providerIntent === "OPT_OUT")
    return { kind: "CLOSE", instruction: "Acknowledge the opt-out and end immediately.", outcome: "DECLINED" };
  if (extraction.providerIntent === "HOLD") return { kind: "WAIT", instruction: "Wait silently." };
  if (extraction.providerIntent === "GOODBYE" || extraction.providerFinal)
    return { kind: "CLOSE", instruction: "Thank them briefly and end without asking another question.", outcome: state.canClose ? "QUOTED" : "CALLBACK_REQUIRED" };
  const unresolved = state.contradictions.find((conflict) => !conflict.resolved);
  if (unresolved) return { kind: "CLARIFY", instruction: questionFor(unresolved.key) };
  if (state.criticalGaps.length) return { kind: "ASK", instruction: questionFor(state.criticalGaps[0]) };
  call.draft ??= { lineItems: [], statedTotalMinor: null, terms: {} };
  if (!call.draft.terms.final_confirmation_requested) {
    call.draft.terms.final_confirmation_requested = true;
    return { kind: "CONFIRM", instruction: "Confirm the exact all-in total and included required scope in one short question." };
  }
  return { kind: "CLOSE", instruction: "Thank them briefly and end the call.", outcome: "QUOTED" };
}

function turnId(callId: string, utterance: string, messageIndex: number) {
  return `turn_${createHash("sha256").update(`${callId}:${messageIndex}:${utterance}`).digest("hex").slice(0, 20)}`;
}

export function createConversationController(env: NodeJS.ProcessEnv = process.env, provided?: ControllerModels) {
  const models = provided ?? openAiModels(env);
  const locks = new Map<string, Promise<unknown>>();
  async function locked<T>(callId: string, fn: () => Promise<T>): Promise<T> {
    const prior = locks.get(callId) ?? Promise.resolve();
    const current = prior.catch(() => undefined).then(fn);
    locks.set(callId, current);
    try { return await current; } finally { if (locks.get(callId) === current) locks.delete(callId); }
  }
  async function processTurn(input: { callId: string; providerId: string; utterance: string; messageIndex: number }): Promise<ControllerResult> {
    return locked(input.callId, async () => {
      const initial = getCallContext(input.callId, input.providerId);
      const id = turnId(input.callId, input.utterance, input.messageIndex);
      const alreadySeen = initial.call.transcript.some((turn) => turn.turnId === id);
      try {
        const before = summarizeCallIntelligence(initial.negotiation, initial.call);
        const extraction = await models.extract({ utterance: input.utterance, phase: initial.call.phase, knownState: before });
        let state = before;
        mutate(() => {
          const { negotiation, call } = getCallContext(input.callId, input.providerId);
          if (!alreadySeen) call.transcript.push({ turnId: id, speaker: "SHOP", text: input.utterance, timeSeconds: null });
          const facts = exactEvidenceFacts(input.utterance, extraction);
          if (facts.length && !alreadySeen) {
            const provenanceId = `prov_${randomUUID()}`;
            const anchor: ProvenanceAnchor = { provenanceId, conversationId: call.conversationId ?? call.callId, turnId: id, speaker: "PROVIDER", transcriptExcerpt: input.utterance, claimType: "STATEMENT", extractionMethod: "POST_CALL_EXTRACTION", confidence: Math.min(...facts.map((fact) => fact.confidence ?? 1)) };
            negotiation.evidence.push(anchor);
            state = applyProviderObservation(negotiation, call, { turnId: id, provenanceId, facts });
          } else state = summarizeCallIntelligence(negotiation, call);
          if (!alreadySeen) mergeScenarios(input.callId, id, input.utterance, extraction);
          call.consecutivePipelineFailures = 0;
        });
        const { negotiation, call } = getCallContext(input.callId, input.providerId);
        const action = mutate(() => chooseAction(negotiation, call, state, extraction));
        if (extraction.providerIntent === "OPT_OUT") mutate(() => { getCallContext(input.callId).provider.doNotCall = true; });
        if (action.kind === "WAIT") return { type: "system_tool", name: "skip_turn", arguments: { reason: "Provider requested time" }, action } as ControllerResult;
        if (action.kind === "CLOSE") {
          mutate(() => {
            const ctx = getCallContext(input.callId);
            ctx.call.outcome = action.outcome ?? "DROPPED";
            ctx.call.reason = action.instruction;
          });
          return { type: "system_tool", name: "end_call", arguments: { reason: action.instruction, message: action.outcome === "QUOTED" ? "Thank you, that gives me what I need. Have a good day." : "Thanks for your time. I’ll follow up if needed." }, action } as ControllerResult;
        }
        const text = safeSpeech(await models.verbalize({ action, utterance: input.utterance, state }), action);
        return { type: "speech", text, action } as ControllerResult;
      } catch (error) {
        let failures = 0;
        mutate(() => { const call = getCallContext(input.callId).call; failures = ++call.consecutivePipelineFailures; });
        const action: ControllerAction = failures <= 1
          ? { kind: "SAFE_FAIL", instruction: "Ask the provider once to repeat their last answer." }
          : { kind: "CLOSE", instruction: "End safely after repeated processing failure.", outcome: "DROPPED" };
        if (failures <= 1) return { type: "speech", text: "Sorry, could you repeat that once for me?", action } as ControllerResult;
        return { type: "system_tool", name: "end_call", arguments: { reason: action.instruction, message: "I’m sorry, I’m having trouble on my end. I’ll follow up another time." }, action } as ControllerResult;
      }
    });
  }
  async function reconcileTranscript(input: { callId: string; providerId: string; turns: Array<{ turnId: string; text: string }> }) {
    return locked(input.callId, async () => {
      for (const turn of input.turns) {
        const context = getCallContext(input.callId, input.providerId);
        if (context.negotiation.evidence.some((item) => item.turnId === turn.turnId && item.extractionMethod !== "LIVE_TOOL")) continue;
        try {
          const knownState = summarizeCallIntelligence(context.negotiation, context.call);
          const extraction = await models.extract({ utterance: turn.text, phase: context.call.phase, knownState });
          const facts = exactEvidenceFacts(turn.text, extraction);
          mutate(() => {
            const { negotiation, call } = getCallContext(input.callId, input.providerId);
            const provenanceId = `prov_${randomUUID()}`;
            negotiation.evidence.push({ provenanceId, conversationId: call.conversationId ?? call.callId, turnId: turn.turnId, speaker: "PROVIDER", transcriptExcerpt: turn.text, claimType: "STATEMENT", extractionMethod: "POST_CALL_EXTRACTION", confidence: facts.length ? Math.min(...facts.map((fact) => fact.confidence ?? 1)) : 0 });
            if (facts.length) applyProviderObservation(negotiation, call, { turnId: turn.turnId, provenanceId, facts });
            mergeScenarios(input.callId, turn.turnId, turn.text, extraction);
          });
        } catch {
          // Preserve the transcript even when one turn cannot be extracted; later replay can retry it.
        }
      }
      const { negotiation, call } = getCallContext(input.callId, input.providerId);
      return summarizeCallIntelligence(negotiation, call);
    });
  }
  return { processTurn, reconcileTranscript };
}

export function parseCustomLlmRequest(body: unknown) {
  const parsed = z.object({
    messages: z.array(z.object({ role: z.string(), content: z.union([z.string(), z.array(z.unknown())]) })),
    model: z.string().optional(),
    elevenlabs_extra_body: z.record(z.unknown()).optional(),
  }).passthrough().parse(body);
  const extra = parsed.elevenlabs_extra_body ?? {};
  const users = parsed.messages.map((message, index) => ({ message, index })).filter(({ message }) => message.role === "user" && typeof message.content === "string");
  const latest = users.at(-1);
  if (!latest) throw new Error("no provider turn found");
  return {
    callId: String(extra.call_id ?? ""),
    providerId: String(extra.provider_id ?? ""),
    attemptNumber: Number(extra.attempt_number ?? 1),
    controllerVersion: String(extra.controller_version ?? ""),
    utterance: latest.message.content as string,
    messageIndex: latest.index,
  };
}
