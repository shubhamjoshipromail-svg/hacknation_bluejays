import { dispatchTool } from "../tools.js";

export type WireFact={key:string;status:"KNOWN"|"NOT_APPLICABLE"|"REFUSED"|"AMBIGUOUS";value?:string;amount_minor?:number;item_status?:"INCLUDED"|"EXCLUDED"|"NOT_APPLICABLE"|"UNKNOWN";confirmed_correction?:boolean};
export type ShopVariant={when?:string[];utterance:string;facts:WireFact[]};
export type Expected={outcome:"QUOTED"|"CALLBACK_REQUIRED"|"DECLINED"|"DROPPED";finalTotalMinor:number|null;reconciliation:"MATCH"|"TOTAL_MISMATCH"|"NOT_COMPARABLE_YET"|null;mustResolve:string[];mustStayUnresolved?:string[];expectRedFlags?:string[];appointmentCompatible?:boolean;persistFacts?:boolean};
export type ScenarioProvider={providerId:string;displayName:string;responses:Record<string,ShopVariant[]>};
export type Scenario={id:string;name:string;version:number;persona:string;mode?:"INTAKE"|"NEGOTIATION";intake:{service?:"REPAIR"|"REPLACEMENT"|"NOT_SURE";features?:Array<"FRONT_CAMERA"|"RAIN_SENSOR"|"HEATED_GLASS"|"HUD"|"NOT_SURE">;schedulePreference?:string|null};shop?:{displayName:string;responses:Record<string,ShopVariant[]>};providers?:ScenarioProvider[];negotiation?:{target:string;concessionMinor:number|null;expectDecision:"ALLOW"|"DENY";expectedFinalMinor:number|null};events?:Array<{type:"DISCONNECT";afterProviderTurns:number}>;privateTruth:Record<string,number|null>;expected:Expected};
export type CallState={canClose:boolean;completionStatus:string;criticalGaps:string[];optionalGaps:string[];contradictions:Array<{key:string;resolved:boolean}>;recommendedGoals:Array<{key:string;question:string}>;askedTopics:string[]};
export type DriverMode="adaptive"|"naive";
export type DriverResult={closeError:string|null;providerTurns:number;outcome:unknown};

/** The simulated shop only ever speaks from the scenario contract; the negotiator side never sees privateTruth. */
export class SimulatedShop{
  private asked=new Set<string>();
  private consumed=new Set<string>();
  constructor(private scenario:Scenario){}
  available(key:string):number|null{
    const variants=this.scenario.shop?.responses[key]??[];
    let pick:number|null=null;
    variants.forEach((v,i)=>{if((v.when??[]).every(k=>this.asked.has(k))&&!this.consumed.has(`${key}:${i}`))pick=i});
    return pick;
  }
  respond(key:string):ShopVariant|null{
    const pick=this.available(key);
    this.asked.add(key);
    if(pick==null)return null;
    this.consumed.add(`${key}:${pick}`);
    return (this.scenario.shop?.responses[key]??[])[pick];
  }
}

/**
 * Drives the real backend conversation brain through dispatchTool, the same stable
 * interface the ElevenLabs voice agent uses. "adaptive" mirrors the intake prompt's
 * policy (follow get_call_state goals); "naive" seeds a known-bad agent for evaluator calibration.
 */
export function runDriver(scenario:Scenario,ids:{callId:string;providerId:string;conversationId:string},mode:DriverMode):DriverResult{
  const ctx={call_id:ids.callId,provider_id:ids.providerId,conversation_id:ids.conversationId};
  const shop=new SimulatedShop(scenario);
  const dispatch=(name:string,args:Record<string,unknown>={})=>dispatchTool(name,{...ctx,...args});
  let closeError:string|null=null,providerTurns=0,turn=0;
  const record=(goal:string|null,v:ShopVariant)=>{providerTurns++;return dispatch("record_provider_answer",{turn_id:`turn_${scenario.id}_${++turn}`,turn_text:v.utterance,question_topic:goal,facts:v.facts}) as CallState};
  const close=(outcome:string,reason:string)=>{try{return dispatch("close_call",{outcome,reason})}catch(e){closeError=(e as Error).message;return dispatch("close_call",{outcome:"CALLBACK_REQUIRED",reason:"provider answers were incomplete; a callback is required"})}};

  let state=dispatch("get_call_state") as CallState;
  if(mode==="naive"){
    const v=shop.respond("TOTAL");
    if(v)state=record("TOTAL",v);
    const naiveOutcome=close("QUOTED","confirmed headline price");
    return {closeError,providerTurns,outcome:naiveOutcome};
  }
  const unanswerable=new Set<string>();
  const disconnectAt=scenario.events?.find(e=>e.type==="DISCONNECT")?.afterProviderTurns??null;
  for(let i=0;i<25;i++){
    if(disconnectAt!=null&&providerTurns>=disconnectAt)return {closeError,providerTurns,outcome:dispatch("close_call",{outcome:"DROPPED",reason:"call disconnected mid-quote"})};
    if(state.canClose){const closed=close("QUOTED","provider confirmed the usable all-in quote");return {closeError,providerTurns,outcome:closed}}
    const goals=state.recommendedGoals.map(g=>g.key);
    const goal=goals.find(k=>shop.available(k)!=null)??goals.find(k=>!unanswerable.has(k));
    if(!goal){const closed=close("CALLBACK_REQUIRED","provider could not complete a usable quote");return {closeError,providerTurns,outcome:closed}}
    const v=shop.respond(goal);
    if(!v){unanswerable.add(goal);state=record(goal,{utterance:"I can't really say on that one.",facts:[{key:goal,status:"REFUSED",value:"provider would not answer"}]});continue}
    state=record(goal,v);
  }
  const fallback=close("CALLBACK_REQUIRED","turn limit reached");
  return {closeError,providerTurns,outcome:fallback};
}

export type NegotiationResult={decision:{decision:"ALLOW"|"DENY";allowedStatement:string|null;factIds:string[]};negotiatedQuoteId:string|null;outcome:unknown};

/**
 * Drives a negotiation callback exactly as the negotiation prompt instructs: fetch the prior
 * quote, request PRICE_MATCH leverage, speak only the policy-approved statement, and record
 * a counteroffer only if the provider actually concedes. Never implies a competitor on DENY.
 */
export function runNegotiationDriver(scenario:Scenario,ids:{callId:string;providerId:string;conversationId:string}):NegotiationResult{
  const ctx={call_id:ids.callId,provider_id:ids.providerId,conversation_id:ids.conversationId};
  const dispatch=(name:string,args:Record<string,unknown>={})=>dispatchTool(name,{...ctx,...args});
  const prior=dispatch("get_prior_quote") as {initialQuoteId:string;allInMinor:number};
  const decision=dispatch("request_leverage",{desired_concession:"PRICE_MATCH",round:1,prior_rounds:0}) as NegotiationResult["decision"];
  if(decision.decision!=="ALLOW"||!decision.allowedStatement){
    return {decision,negotiatedQuoteId:null,outcome:dispatch("close_call",{outcome:"DECLINED",reason:"no verified leverage available and provider held firm"})};
  }
  const concession=scenario.negotiation?.concessionMinor??0;
  const revised=prior.allInMinor-concession;
  const offer=dispatch("record_counteroffer",{initial_quote_id:prior.initialQuoteId,total_minor:revised,turn_id:`turn_${scenario.id}_nego`,turn_text:`I can revise the all-in total to $${(revised/100).toFixed(2)}.`}) as {quoteId:string};
  return {decision,negotiatedQuoteId:offer.quoteId,outcome:dispatch("close_call",{outcome:"QUOTED",reason:"provider confirmed the revised all-in total"})};
}
