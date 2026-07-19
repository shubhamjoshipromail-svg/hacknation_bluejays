export type RunMode="SANDBOX";
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
  providers:Array<{providerId:string;name:string;phoneNumber:string;locationLabel:string;source:"SANDBOX_CONFIG";verified:boolean}>;
  benchmark:{lowMinor:number;typicalMinor:number;highMinor:number;classification:string;sourceLabel:string;notes:string[]};
  strategy:{realisticTargetMinor:number;openingPositionMinor:number;walkAwayMinor:number;keyArguments:string[];questions:string[];requestConcessions:string[];risksToAvoid:string[]};
  approvals:Array<{action:string}>;
  calls:Array<{callId:string;providerId:string;conversationId:string|null;twilioCallSid:string|null;phase:CallPhase;status:CallStatus;outcome:CallOutcome|null;reason:string|null;transcript:Array<{turnId:string;speaker:"AGENT"|"SHOP";text:string;timeSeconds:number|null}>}>;
  offers:Array<{quoteId:string;providerId:string;callId:string;stage:"INITIAL"|"NEGOTIATED";lineItems:Array<{category:string;rawLabel:string;amountMinor:number|null;status:"INCLUDED"|"EXCLUDED"|"NOT_APPLICABLE"|"UNKNOWN";provenanceIds:string[]}>;totals:{statedAllInMinor:number|null};comparability:"COMPARABLE"|"CONDITIONALLY_COMPARABLE"|"NON_COMPARABLE";redFlags:Array<{detail:string}>}>;
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
