import fs from "node:fs";
import { randomUUID } from "node:crypto";
import YAML from "yaml";
import OpenAI from "openai";
import type { CallOutcome, FeeCategory, QuoteLineItem, QuoteOffer, Recommendation } from "./domain.js";
import { applyRedFlags, computeKnownTotal, freezeSpecCore, mintCompetitorOfferFact, rankQuotes, requestLeverage } from "./policy.js";
import { CALL_BRIEF, jobSpec, specHash } from "./config.js";
import { mutate, resetStore, store } from "./store.js";
import { recordTurn as storeRecordTurn, tools } from "./tools.js";
import { logTimeline, planNegotiation } from "./playbook.js";

type Phase = "QUOTE" | "NEGOTIATION";
type Persona = { persona_id:string; display_name:string; private:{target_total_minor:number;line_items:Partial<Record<FeeCategory,number>>;concessions:{trigger:string;action:string}[]}; public:{offers_written_confirmation:boolean;quote_validity:string} };
resetStore();
export const transcriptTurns=store.transcriptTurns;
export const provenance=store.provenance;
export const quotes=store.quotes;
export const outcomes=store.outcomes;
export const verifiedFacts=store.verifiedFacts;

const CATEGORIES:FeeCategory[]=["BASE_GLASS_AND_INSTALL","ADAS_CALIBRATION","MOBILE_SERVICE","MOLDINGS_CLIPS_SENSOR_KIT","DISPOSAL_ENVIRONMENTAL","TAX"];
function recordTurn(callId:string,speaker:"PROVIDER"|"BUYER_AGENT",text:string){const turn=storeRecordTurn(callId,speaker,text);console.log(`${speaker}: ${text}`);return turn}
function persona(id:string):Persona{return YAML.parse(fs.readFileSync(`persona.${id}.yaml`,"utf8"))}
function expiry(label:string){const d=new Date();d.setUTCDate(d.getUTCDate()+(label==="today"?1:label==="1 week"?7:14));return d.toISOString()}

export async function runConversation(personaId:string,phase:Phase="QUOTE",initial?:QuoteOffer):Promise<CallOutcome>{
  const p=persona(personaId),callId=`call_${randomUUID()}`;console.log(`\n=== ${p.display_name} / ${phase} ===`);
  if(phase==="NEGOTIATION"){
    if(!initial)throw new Error("Negotiation requires initial quote");
    recordTurn(callId,"BUYER_AGENT",`I'm calling about your earlier all-in quote of $${(initial.totals.statedAllInMinor!/100).toFixed(2)}.`);
    const decision=tools.request_leverage(callId,personaId,"PRICE_MATCH",1,0);
    if(decision.decision!=="ALLOW"||!decision.allowedStatement)return tools.close_call(callId,personaId,"DECLINED","policy denied leverage",null);
    const plan=planNegotiation(personaId,{policyAllow:true,userTradeoffs:jobSpec.core.schedule.flexible});
    if(plan.some(t=>t.name==="anchor_verified_quote"))logTimeline("TACTIC","anchor_verified_quote",callId);
    recordTurn(callId,"BUYER_AGENT",decision.allowedStatement);
    recordTurn(callId,"BUYER_AGENT","Can you match it or waive a fee?");
    if(plan.some(t=>t.name==="strategic_silence"))logTimeline("TACTIC","strategic_silence",callId);
    const concession=p.private.concessions.find(c=>c.trigger==="verified_competitor_all_in");
    if(!concession)return tools.close_call(callId,personaId,"DECLINED","provider declined verified price request",null);
    logTimeline("TRIGGER",concession.trigger,callId,`${personaId} → ${concession.action}`);
    const amount=Number(concession.action.match(/\d+/)?.[0]??0), revised=initial.totals.statedAllInMinor!-amount;
    const providerTurn=recordTurn(callId,"PROVIDER",`I can revise the all-in total to $${(revised/100).toFixed(2)}.`);
    const negotiated=tools.record_counteroffer(initial,callId,revised,providerTurn);mutate(s=>s.quotes.push(negotiated));
    if(plan.some(t=>t.name==="summarize_commit"))logTimeline("TACTIC","summarize_commit",callId);
    recordTurn(callId,"BUYER_AGENT",`Confirming the revised all-in total is $${(revised/100).toFixed(2)}, including calibration and tax. The customer makes the final decision.`);
    return tools.close_call(callId,personaId,"QUOTED","provider confirmed revised all-in total",negotiated.quoteId);
  }
  recordTurn(callId,"BUYER_AGENT","I'm an AI assistant calling for a customer. I'm requesting a windshield replacement quote, and this call may be transcribed.");
  tools.get_call_brief();recordTurn(callId,"BUYER_AGENT",CALL_BRIEF);recordTurn(callId,"BUYER_AGENT","What is your all-in price?");
  if(personaId==="mobile_operator")recordTurn(callId,"PROVIDER","Usually $500 to $700, depending on the schedule.");
  if(personaId==="independent_lowballer")recordTurn(callId,"PROVIDER","It's $285 installed—when do you want to come in?");
  const lineItems:QuoteLineItem[]=[];
  for(const category of CATEGORIES){recordTurn(callId,"BUYER_AGENT",`Please confirm ${category} and whether it is included.`);const amount=p.private.line_items[category];const response=recordTurn(callId,"PROVIDER",amount==null?`${category} is not applicable and there is no charge.`:`${category} is included at $${(amount/100).toFixed(2)}.`);lineItems.push(tools.log_quote_item(response,category,category,amount??null,amount==null?"NOT_APPLICABLE":"INCLUDED",category==="ADAS_CALIBRATION"?{calibrationType:personaId==="mobile_operator"?"DYNAMIC":"STATIC"}:{}))}
  const known=computeKnownTotal({lineItems});const allIn=known.computedKnownMinor;const confirm=recordTurn(callId,"PROVIDER",`Yes, $${(allIn/100).toFixed(2)} all-in including calibration and tax.`);tools.log_quote_total(confirm,allIn);
  const termTurn=recordTurn(callId,"PROVIDER",`The quote is valid ${p.public.quote_validity}. Written confirmation is ${p.public.offers_written_confirmation?"available":"not available"}.`);tools.log_term(termTurn);
  const q:QuoteOffer={quoteId:`quote_${randomUUID()}`,providerId:personaId,callId,specRevision:1,offerVersion:1,stage:"INITIAL",currency:"USD",lineItems,totals:{statedAllInMinor:allIn,computedKnownMinor:known.computedKnownMinor,taxStatus:"INCLUDED",reconciliation:known.isAllIn&&allIn===known.computedKnownMinor?"MATCH":"NOT_COMPARABLE_YET"},terms:{validUntil:expiry(p.public.quote_validity),writtenConfirmation:p.public.offers_written_confirmation,warranty:"lifetime workmanship",appointmentWindow:"weekday morning"},comparability:"COMPARABLE",redFlags:[]};mutate(s=>s.quotes.push(q));
  recordTurn(callId,"BUYER_AGENT","Thank you. The customer will make the final decision.");return tools.close_call(callId,personaId,"QUOTED","provider confirmed usable itemized all-in quote",q.quoteId);
}

function normalizeAll(){const initial=quotes.filter(q=>q.stage==="INITIAL");for(const q of initial){q.redFlags=applyRedFlags(q,initial.filter(o=>o!==q).map(o=>o.totals.statedAllInMinor!),true);if(q.providerId==="independent_lowballer")q.redFlags.push({code:"HEADLINE_PRICE_OMITTED_FEES",detail:"The opening $285 headline omitted calibration and tax disclosed by the checklist."})}}
async function generateReport(rec:Recommendation){if(!process.env.OPENAI_API_KEY)return "Recommendation prose skipped because OPENAI_API_KEY is not set; ranking JSON remains authoritative.";const client=new OpenAI();const response=await client.chat.completions.create({model:process.env.OPENAI_MODEL??"gpt-4o-mini",messages:[{role:"system",content:"Write a 150-word plain-language explanation. Use ONLY the numbers in the provided JSON. Do not compute, estimate, or add any number not present."},{role:"user",content:JSON.stringify(rec)}]});return response.choices[0].message.content??""}

async function main(){console.log(`SPEC HASH: ${specHash}`);for(const id of ["premium_chain","independent_lowballer","mobile_operator"])await runConversation(id);normalizeAll();console.log("\nRED FLAGS:",JSON.stringify(quotes.filter(q=>q.stage==="INITIAL").map(q=>({provider:q.providerId,redFlags:q.redFlags})),null,2));
  for(const q of quotes.filter(q=>q.stage==="INITIAL")){const f=mintCompetitorOfferFact(q,specHash);if(f)mutate(s=>s.verifiedFacts.push(f))}
  const target=quotes.filter(q=>q.stage==="INITIAL"&&q.comparability==="COMPARABLE"&&q.totals.reconciliation==="MATCH").sort((a,b)=>b.totals.statedAllInMinor!-a.totals.statedAllInMinor!)[0];const negotiation=await runConversation(target.providerId,"NEGOTIATION",target);const negotiated=quotes.find(q=>q.quoteId===negotiation.quoteId)!;const savings=target.totals.statedAllInMinor!-negotiated.totals.statedAllInMinor!;console.log(`\nNEGOTIATION: ${target.totals.statedAllInMinor} → verified_competitor_all_in → ${negotiated.totals.statedAllInMinor} → savings ${savings} cents`);
  const ranked=rankQuotes(quotes);const rec:Recommendation={runId:`run_${randomUUID()}`,ranked,bestValueQuoteId:ranked.find(r=>r.eligible)?.quoteId??null,cheapestComparableQuoteId:[...quotes].filter(q=>q.comparability==="COMPARABLE").sort((a,b)=>a.totals.statedAllInMinor!-b.totals.statedAllInMinor!)[0]?.quoteId??null,verifiedSavingsMinor:savings,explanationProse:""};
  const emptyDeny=requestLeverage({callId:"gate",targetProviderId:"premium_chain",desiredConcession:"PRICE_MATCH",round:1},[],0).decision==="DENY";const low=quotes.find(q=>q.providerId==="independent_lowballer"&&q.stage==="INITIAL")!;const gates={outcomes:outcomes.length===4&&outcomes.every(o=>o.reason.trim()&&o.outcome!=="DROPPED"),lowballerADAS:low.lineItems.some(li=>li.category==="ADAS_CALIBRATION")&&low.redFlags.some(f=>["CALIBRATION_OMITTED","SUSPICIOUS_LOWBALL","HEADLINE_PRICE_OMITTED_FEES"].includes(f.code)),verifiedFact:verifiedFacts.length>0,negotiatedLower:quotes.some(q=>q.stage==="NEGOTIATED"&&q.totals.statedAllInMinor!<target.totals.statedAllInMinor!),emptyFactsDeny:emptyDeny,provenance:quotes.every(q=>q.lineItems.every(li=>li.provenanceIds.every(id=>{const p=provenance[id];return !!p&&!!transcriptTurns[p.turnId]})))};const all=Object.values(gates).every(Boolean);mutate(s=>{s.ranking=rec});console.log("\nRANKING JSON:",JSON.stringify(rec,null,2));console.log("GATE:",JSON.stringify({...gates,all},null,2));if(!all){process.exitCode=1;return}rec.explanationProse=await generateReport(rec);console.log("\nREPORT:\n"+rec.explanationProse)}
if(import.meta.url===`file://${process.argv[1]}`)main().catch(e=>{console.error(e);process.exitCode=1});
