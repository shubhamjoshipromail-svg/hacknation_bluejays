export type RunMode="SANDBOX"|"REAL";
export type CallPhase="QUOTE_COLLECTION"|"NEGOTIATION";
export type CallStatus="QUEUED"|"IN_PROGRESS"|"COMPLETE"|"FAILED";
export type CallOutcome="QUOTED"|"CALLBACK_REQUIRED"|"DECLINED"|"DROPPED";

export interface RunView{
  negotiationId:string;
  mode:RunMode;
  state:string;
  intake:{
    objective:string;currentSituation:string;priorities:string[];constraints:string[];
    desiredOutcomeMinor:number|null;walkAwayMinor:number|null;postalCode:string;
    vehicle:{year:number;make:string;model:string;vin:string|null;frontCamera:boolean};
    damage:{service:"REPAIR"|"REPLACEMENT"|"NOT_SURE";type:"CHIP"|"CRACK"|"SHATTERED"|"OTHER"|"NOT_SURE";location:"DRIVER_SIDE"|"PASSENGER_SIDE"|"CENTER"|"EDGE"|"MULTIPLE"|"NOT_SURE";drivable:boolean};
    features:Array<"FRONT_CAMERA"|"RAIN_SENSOR"|"HEATED_GLASS"|"HUD"|"NOT_SURE">;
    insuranceInvolved:boolean;schedulePreference:string|null;
    sources:Array<{kind:string;label:string}>;
  };
  providers:Array<{providerId:string;name:string;phoneNumber:string;locationLabel:string;source:"SANDBOX_CONFIG"|"CONSENT_REGISTRY";verified:boolean;doNotCall?:boolean;consent?:{status:"OPTED_IN"|"REVOKED"|"EXPIRED";jurisdiction:string;source:string;capturedAt:string;expiresAt:string|null;evidenceRef:string}}>;
  benchmark:{lowMinor:number;typicalMinor:number;highMinor:number;classification:string;sourceLabel:string;notes:string[]};
  benchmarkContext:null|{schemaVersion:"1.0";generatedAt:string;expectedRangeMinor:[number,number]|null;requiredQuestions:string[];warnings:string[];evidence:Array<{signalId:string;kind:string;label:string;lowMinor:number;typicalMinor:number|null;highMinor:number;strength:string;publisher:string;url:string;excerpt:string}>;liveQuoteSampleSize:number};
  strategy:{realisticTargetMinor:number;openingPositionMinor:number;walkAwayMinor:number;keyArguments:string[];questions:string[];requestConcessions:string[];risksToAvoid:string[]};
  approvals:Array<{action:string}>;
  calls:Array<{callId:string;providerId:string;conversationId:string|null;twilioCallSid:string|null;phase:CallPhase;status:CallStatus;outcome:CallOutcome|null;reason:string|null;attemptNumber:number;supersedesCallId:string|null;isActiveAttempt:boolean;controllerMode:"HOSTED_TOOLS"|"BACKEND_CUSTOM_LLM";deployment:null|{controllerVersion:string;agentVersion:string;extractorPromptVersion:string;plannerPromptVersion:string};retentionPurgedAt:string|null;transcript:Array<{turnId:string;speaker:"AGENT"|"SHOP";text:string;timeSeconds:number|null}>;draft:null|{lineItems:Array<{category:string;rawLabel:string;amountMinor:number|null;status:"INCLUDED"|"EXCLUDED"|"NOT_APPLICABLE"|"UNKNOWN";provenanceIds:string[]}>;statedTotalMinor:number|null;terms:Record<string,unknown>};intelligence:null|{facts:Array<{key:string;status:string;value:string|null;amountMinor:number|null;itemStatus:string|null;provenanceIds:string[];updatedAt:string}>;beliefs:Array<unknown>;goals:Array<unknown>;askedTopics:string[];contradictions:Array<{contradictionId:string;key:string;previousValue:string;proposedValue:string;resolved:boolean;createdAt:string;resolvedAt:string|null}>;lastProviderTurnId:string|null;criticalGaps:string[];optionalGaps:string[];completionStatus:"NOT_QUOTABLE"|"NEEDS_ONE_CLARIFICATION"|"USABLE_BUT_INCOMPLETE"|"READY_TO_CLOSE";canClose:boolean;updatedAt:string}}>;
  offers:Array<{quoteId:string;providerId:string;callId:string;stage:"INITIAL"|"NEGOTIATED";lineItems:Array<{category:string;rawLabel:string;amountMinor:number|null;status:"INCLUDED"|"EXCLUDED"|"NOT_APPLICABLE"|"UNKNOWN";provenanceIds:string[]}>;totals:{statedAllInMinor:number|null;computedKnownMinor:number;taxStatus:"INCLUDED"|"EXCLUDED"|"UNKNOWN";reconciliation:"MATCH"|"TOTAL_MISMATCH"|"NOT_COMPARABLE_YET"};comparability:"COMPARABLE"|"CONDITIONALLY_COMPARABLE"|"NON_COMPARABLE";redFlags:Array<{detail:string}>}>;
  ranking:Array<{quoteId:string;eligible:boolean;ineligibleReason:string|null;score:number|null;componentScores:null|{price:number;completeness:number;scopeQuality:number;schedule:number;terms:number};visiblePenalties:string[]}>;
  redFlags:Array<{code:string;severity:string;detail:string}>;
  recommendation:null|{action:string;offerId:string|null;summary:string;reasons:string[];suggestedCounterMinor:number|null};
  policyDecisions:Array<{decisionId:string;decision:"ALLOW"|"DENY";allowedStatement:string|null;denyReason:string|null;at:string}>;
  followUps:Array<{followUpId:string;dueAt:string;note:string;status:string}>;
  events:Array<{eventId:string;type:string;detail:string;at:string}>;
}

export interface SandboxIntakeRequest{
  vehicle:{year:number;make:string;model:string;vin:string|null};
  damage:{service:"REPAIR"|"REPLACEMENT"|"NOT_SURE";type:"CHIP"|"CRACK"|"SHATTERED"|"OTHER"|"NOT_SURE";location:"DRIVER_SIDE"|"PASSENGER_SIDE"|"CENTER"|"EDGE"|"MULTIPLE"|"NOT_SURE";drivable:boolean};
  features:Array<"FRONT_CAMERA"|"RAIN_SENSOR"|"HEATED_GLASS"|"HUD"|"NOT_SURE">;
  postalCode:string;insuranceInvolved:boolean;schedulePreference:string|null;
}
