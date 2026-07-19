import fs from "node:fs";
import path from "node:path";
import type { CallOutcome, Negotiation, PolicyDecision, ProvenanceAnchor, QuoteLineItem, QuoteOffer, VerifiedFact } from "./domain.js";

export type Turn={turnId:string;callId:string;speaker:"PROVIDER"|"BUYER_AGENT"|"USER";text:string;conversationId?:string};
export type TimelineEvent={type:"TRIGGER"|"TACTIC"|"RECONCILE_WARN";name:string;callId:string;at:string;detail?:string};
export type VoiceDraft={callId:string;providerId:string;lineItems:QuoteLineItem[];statedTotalMinor:number|null;terms:Record<string,unknown>};
export type RunStore={negotiations:Record<string,Negotiation>;currentNegotiationId:string|null;providerRegistry:Negotiation["providers"];transcriptTurns:Record<string,Turn>;provenance:Record<string,ProvenanceAnchor>;drafts:Record<string,VoiceDraft>;quotes:QuoteOffer[];outcomes:CallOutcome[];verifiedFacts:VerifiedFact[];policyDecisions:PolicyDecision[];timelineEvents:TimelineEvent[];ranking:unknown|null};
const empty=():RunStore=>({negotiations:{},currentNegotiationId:null,providerRegistry:[],transcriptTurns:{},provenance:{},drafts:{},quotes:[],outcomes:[],verifiedFacts:[],policyDecisions:[],timelineEvents:[],ranking:null});
const storePath=process.env.RUN_STORE_PATH??path.resolve(".data/current-run.json");
export let store:RunStore=empty();
export function loadStore(){try{store={...empty(),...JSON.parse(fs.readFileSync(storePath,"utf8")) as RunStore};store.providerRegistry??=[];for(const negotiation of Object.values(store.negotiations)){negotiation.mode??="SANDBOX";negotiation.calls??=[];negotiation.callIds??=[];negotiation.providers??=[];negotiation.evidence??=[];negotiation.verifiedFacts??=[];negotiation.policyDecisions??=[];negotiation.benchmarkContext??=null;negotiation.quoteScenarios??=[];negotiation.negotiationStrategy??=null;for(const provider of negotiation.providers){provider.doNotCall??=false}for(const call of negotiation.calls){call.phase??="QUOTE_COLLECTION";call.twilioCallSid??=null;call.draft??=null;call.intelligence??=null;call.attemptNumber??=1;call.supersedesCallId??=null;call.isActiveAttempt??=true;call.controllerMode??="HOSTED_TOOLS";call.deployment??=null;call.consecutivePipelineFailures??=0;call.retentionPurgedAt??=null;if(call.intelligence){call.intelligence.beliefs??=[];call.intelligence.goals??=[];call.intelligence.criticalGaps??=[];call.intelligence.optionalGaps??=[];call.intelligence.completionStatus??="NOT_QUOTABLE";call.intelligence.canClose??=false}if(call.conversationId==="pending")call.conversationId=null}}}catch{store=empty()}return store}
export function resetStore(){store=empty();persistStore();return store}
export function persistStore(){fs.mkdirSync(path.dirname(storePath),{recursive:true});const temp=`${storePath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;fs.writeFileSync(temp,JSON.stringify(store,null,2),{mode:0o600});fs.renameSync(temp,storePath)}
export function mutate<T>(fn:(s:RunStore)=>T){const result=fn(store);persistStore();return result}
export function snapshot(){return structuredClone(store)}
loadStore();
