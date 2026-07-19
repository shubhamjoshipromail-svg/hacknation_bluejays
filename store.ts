import fs from "node:fs";
import path from "node:path";
import type { CallOutcome, PolicyDecision, ProvenanceAnchor, QuoteLineItem, QuoteOffer, VerifiedFact } from "./domain.js";

export type Turn={turnId:string;callId:string;speaker:"PROVIDER"|"BUYER_AGENT"|"USER";text:string;conversationId?:string};
export type TimelineEvent={type:"TRIGGER"|"TACTIC"|"RECONCILE_WARN";name:string;callId:string;at:string;detail?:string};
export type VoiceDraft={callId:string;providerId:string;lineItems:QuoteLineItem[];statedTotalMinor:number|null;terms:Record<string,unknown>};
export type RunStore={transcriptTurns:Record<string,Turn>;provenance:Record<string,ProvenanceAnchor>;drafts:Record<string,VoiceDraft>;quotes:QuoteOffer[];outcomes:CallOutcome[];verifiedFacts:VerifiedFact[];policyDecisions:PolicyDecision[];timelineEvents:TimelineEvent[];ranking:unknown|null};
const empty=():RunStore=>({transcriptTurns:{},provenance:{},drafts:{},quotes:[],outcomes:[],verifiedFacts:[],policyDecisions:[],timelineEvents:[],ranking:null});
const storePath=process.env.RUN_STORE_PATH??path.resolve(".data/current-run.json");
export let store:RunStore=empty();
export function loadStore(){try{store={...empty(),...JSON.parse(fs.readFileSync(storePath,"utf8")) as RunStore}}catch{store=empty()}return store}
export function resetStore(){store=empty();persistStore();return store}
export function persistStore(){fs.mkdirSync(path.dirname(storePath),{recursive:true});const temp=`${storePath}.tmp`;fs.writeFileSync(temp,JSON.stringify(store,null,2),{mode:0o600});fs.renameSync(temp,storePath)}
export function mutate<T>(fn:(s:RunStore)=>T){const result=fn(store);persistStore();return result}
export function snapshot(){return structuredClone(store)}
loadStore();
