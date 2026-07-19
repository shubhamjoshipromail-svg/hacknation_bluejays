import { randomUUID } from "node:crypto";
import type { CallFactKey, CallIntelligenceFact, Negotiation, NegotiationCall, QuoteLineItem } from "./domain.js";

export type ObservationFactInput={key:CallFactKey;status:"KNOWN"|"NOT_APPLICABLE"|"REFUSED"|"AMBIGUOUS";value?:string|null;amountMinor?:number|null;itemStatus?:QuoteLineItem["status"]|null;confirmedCorrection?:boolean};

const questions:Record<CallFactKey,string>={
  SERVICE_RECOMMENDATION:"Based on the damage, do you recommend repair or replacement?",BASE_PRICE:"What is the glass-and-installation amount before separate fees?",TOTAL:"What is the confirmed all-in cash total?",ALL_IN_SCOPE:"Which fees and services are included in that all-in total?",TAX:"Is sales tax included in that total, excluded, or still to be calculated?",ADAS_INCLUDED:"Does this vehicle require camera or ADAS calibration, and is it included?",ADAS_TYPE:"Would that calibration be static, dynamic, or both?",ADAS_PRICE:"What amount is included for calibration?",GLASS_TYPE:"Is the quoted glass OEM, OEE, or aftermarket?",MOBILE_SERVICE:"Is mobile service included, excluded, or not applicable?",MOLDINGS_CLIPS_SENSOR_KIT:"Are any moldings, clips, or sensor kits additional?",DISPOSAL_ENVIRONMENTAL:"Are disposal or environmental fees included?",SHOP_SUPPLIES:"Are shop supplies included?",WARRANTY:"What warranty is included?",AVAILABILITY:"What is the earliest realistic appointment?",WRITTEN_CONFIRMATION:"Can the itemized quote be provided in writing?",PRICE_CHANGE_CONDITIONS:"What could change the quoted total?",REPRESENTATIVE:"Who should the customer ask for when calling back?",CALLBACK:"What is the best callback number or extension?",QUOTE_REFERENCE:"Is there a quote reference number?",QUOTE_VALIDITY:"How long is this quote valid?",
};
const optional:CallFactKey[]=["MOBILE_SERVICE","MOLDINGS_CLIPS_SENSOR_KIT","DISPOSAL_ENVIRONMENTAL","SHOP_SUPPLIES","AVAILABILITY","WRITTEN_CONFIRMATION","PRICE_CHANGE_CONDITIONS","REPRESENTATIVE","CALLBACK","QUOTE_REFERENCE","QUOTE_VALIDITY","ALL_IN_SCOPE"];
const feeMap:Partial<Record<CallFactKey,QuoteLineItem["category"]>>={BASE_PRICE:"BASE_GLASS_AND_INSTALL",ADAS_INCLUDED:"ADAS_CALIBRATION",ADAS_PRICE:"ADAS_CALIBRATION",MOBILE_SERVICE:"MOBILE_SERVICE",MOLDINGS_CLIPS_SENSOR_KIT:"MOLDINGS_CLIPS_SENSOR_KIT",DISPOSAL_ENVIRONMENTAL:"DISPOSAL_ENVIRONMENTAL",SHOP_SUPPLIES:"SHOP_SUPPLIES",TAX:"TAX"};
const resolved=(fact:CallIntelligenceFact|undefined)=>Boolean(fact&&(fact.status==="KNOWN"||fact.status==="NOT_APPLICABLE"));
const included=(fact:CallIntelligenceFact|undefined)=>Boolean(fact&&(fact.itemStatus==="INCLUDED"||fact.itemStatus==="NOT_APPLICABLE"||/\b(all[- ]?in|included|yes)\b/i.test(fact.value??"")));
const factValue=(fact:Pick<CallIntelligenceFact,"status"|"value"|"amountMinor"|"itemStatus">)=>JSON.stringify(fact.amountMinor!=null?[fact.status,fact.amountMinor,fact.itemStatus]:[fact.status,fact.value?.trim().toLowerCase()??null,fact.itemStatus]);

export function ensureIntelligence(call:NegotiationCall){call.intelligence??={facts:[],askedTopics:[],contradictions:[],lastProviderTurnId:null,criticalGaps:[],optionalGaps:[],completionStatus:"NOT_QUOTABLE",canClose:false,updatedAt:new Date().toISOString()};return call.intelligence}

export function summarizeCallIntelligence(negotiation:Negotiation,call:NegotiationCall){
  const intelligence=ensureIntelligence(call),byKey=new Map(intelligence.facts.map(f=>[f.key,f])),critical:CallFactKey[]=[];
  if(negotiation.intake.damage.service==="NOT_SURE")critical.push("SERVICE_RECOMMENDATION");
  critical.push("TOTAL","ALL_IN_SCOPE","TAX","GLASS_TYPE","WARRANTY");
  const allInConfirmed=included(byKey.get("ALL_IN_SCOPE"));
  if(!allInConfirmed)critical.push("BASE_PRICE");
  const adasPossible=negotiation.intake.vehicle.frontCamera||negotiation.intake.features.includes("NOT_SURE");
  if(adasPossible)critical.push("ADAS_INCLUDED");
  const unresolved=intelligence.contradictions.filter(c=>!c.resolved),criticalGaps=[...new Set(critical)].filter(key=>!resolved(byKey.get(key))||unresolved.some(c=>c.key===key)),optionalGaps=optional.filter(key=>!resolved(byKey.get(key))&&!criticalGaps.includes(key));
  const tax=byKey.get("TAX");
  if(tax?.itemStatus==="EXCLUDED"&&tax.amountMinor==null&&!criticalGaps.includes("TAX"))criticalGaps.push("TAX");
  const hasTotal=resolved(byKey.get("TOTAL"))&&byKey.get("TOTAL")?.amountMinor!=null,completionStatus=unresolved.length?"NEEDS_ONE_CLARIFICATION":!hasTotal?"NOT_QUOTABLE":criticalGaps.length?"USABLE_BUT_INCOMPLETE":"READY_TO_CLOSE",canClose=hasTotal&&!unresolved.length&&!criticalGaps.length;
  intelligence.criticalGaps=criticalGaps;intelligence.optionalGaps=optionalGaps;intelligence.completionStatus=completionStatus;intelligence.canClose=canClose;
  const recommended=[...new Set([...unresolved.map(c=>c.key),...criticalGaps,...optionalGaps])].slice(0,3);
  return {facts:intelligence.facts,askedTopics:intelligence.askedTopics,contradictions:intelligence.contradictions,criticalGaps,optionalGaps,recommendedGoals:recommended.map(key=>({key,question:questions[key]})),completionStatus,canClose,benchmark:{classification:negotiation.benchmark.classification,expectedRangeMinor:negotiation.benchmarkContext?.expectedRangeMinor??[negotiation.benchmark.lowMinor,negotiation.benchmark.highMinor],sourceLabel:negotiation.benchmark.sourceLabel,requiredQuestions:negotiation.benchmarkContext?.requiredQuestions??[],warnings:negotiation.benchmarkContext?.warnings??negotiation.benchmark.notes,directionalOnly:negotiation.benchmark.classification!=="VERIFIED"}};
}

function updateDraft(call:NegotiationCall,fact:ObservationFactInput,provenanceId:string){
  call.draft??={lineItems:[],statedTotalMinor:null,terms:{}};
  if(fact.key==="TOTAL"&&fact.amountMinor!=null)call.draft.statedTotalMinor=fact.amountMinor;
  const category=feeMap[fact.key];
  if(category){const status=fact.itemStatus??(fact.status==="NOT_APPLICABLE"?"NOT_APPLICABLE":fact.status==="KNOWN"?"INCLUDED":"UNKNOWN"),prior=call.draft.lineItems.find(i=>i.category===category),item:QuoteLineItem={category,rawLabel:fact.value?.trim()||questions[fact.key],amountMinor:fact.amountMinor??prior?.amountMinor??null,status,scope:prior?.scope??{},provenanceIds:[...new Set([...(prior?.provenanceIds??[]),provenanceId])]};call.draft.lineItems=call.draft.lineItems.filter(i=>i.category!==category);call.draft.lineItems.push(item)}
  else if(fact.value!=null)call.draft.terms[fact.key.toLowerCase()]=fact.value;
}

export function applyProviderObservation(negotiation:Negotiation,call:NegotiationCall,input:{turnId:string;provenanceId:string;questionTopic?:CallFactKey|null;facts:ObservationFactInput[]}){
  const intelligence=ensureIntelligence(call),now=new Date().toISOString();if(input.questionTopic&&!intelligence.askedTopics.includes(input.questionTopic))intelligence.askedTopics.push(input.questionTopic);
  for(const next of input.facts){const previous=intelligence.facts.find(f=>f.key===next.key),proposed:CallIntelligenceFact={key:next.key,status:next.status,value:next.value??null,amountMinor:next.amountMinor??null,itemStatus:next.itemStatus??null,provenanceIds:[input.provenanceId],updatedAt:now};
    if(previous&&factValue(previous)!==factValue(proposed)&&previous.status==="KNOWN"&&next.status==="KNOWN"&&!next.confirmedCorrection){if(!intelligence.contradictions.some(c=>!c.resolved&&c.key===next.key&&c.proposedValue===factValue(proposed)))intelligence.contradictions.push({contradictionId:`conflict_${randomUUID()}`,key:next.key,previousValue:factValue(previous),proposedValue:factValue(proposed),resolved:false,createdAt:now,resolvedAt:null});continue}
    if(previous){previous.status=proposed.status;previous.value=proposed.value;previous.amountMinor=proposed.amountMinor;previous.itemStatus=proposed.itemStatus;previous.provenanceIds=[...new Set([...previous.provenanceIds,input.provenanceId])];previous.updatedAt=now}else intelligence.facts.push(proposed);
    if(next.confirmedCorrection)for(const conflict of intelligence.contradictions.filter(c=>c.key===next.key&&!c.resolved)){conflict.resolved=true;conflict.resolvedAt=now}
    if(next.key==="SERVICE_RECOMMENDATION"&&next.status==="KNOWN"){const value=next.value?.toLowerCase()??"";if(value.includes("replacement"))negotiation.intake.damage.service="REPLACEMENT";else if(value.includes("repair"))negotiation.intake.damage.service="REPAIR"}
    updateDraft(call,next,input.provenanceId)}
  intelligence.lastProviderTurnId=input.turnId;intelligence.updatedAt=now;return summarizeCallIntelligence(negotiation,call);
}
