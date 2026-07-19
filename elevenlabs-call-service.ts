import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { confirmationPrompt, INTAKE_PROMPT, NEGOTIATION_PROMPT } from "./prompts.js";
import { getCallContext, recordCall } from "./negotiation-service.js";
import { eleven } from "./scripts/elevenlabs-api.js";

type AgentIds={buyer_intake:string;buyer_negotiation:string};
type OutboundResult={success?:boolean;message?:string;conversation_id:string|null;callSid?:string|null};

function agents():AgentIds{
  if(!fs.existsSync("agents.json"))throw new Error("agents.json missing; run npm run provision");
  const value=JSON.parse(fs.readFileSync("agents.json","utf8")) as Partial<AgentIds>;
  if(!value.buyer_intake||!value.buyer_negotiation)throw new Error("sandbox buyer agents are not provisioned");
  return value as AgentIds;
}

export async function startElevenLabsCall(negotiationId:string,providerId:string,phase:"QUOTE_COLLECTION"|"NEGOTIATION"|"CONFIRMATION"="QUOTE_COLLECTION"){
  if((process.env.CALL_MODE??"SANDBOX")!=="SANDBOX")throw new Error("Only SANDBOX call mode is enabled in this build");
  const phoneId=process.env.ELEVENLABS_PHONE_NUMBER_ID;
  if(!process.env.ELEVENLABS_API_KEY||!phoneId)throw new Error("ElevenLabs sandbox calling is not configured");
  const callId=`call_${randomUUID()}`;
  recordCall(negotiationId,{callId,providerId,conversationId:null,phase,status:"QUEUED",outcome:null,reason:null});
  try{
    const {provider,negotiation}=getCallContext(callId,providerId),ids=agents();
    const v=negotiation.intake.vehicle,d=negotiation.intake.damage;
    const serviceText=d.service==="NOT_SURE"?"a windshield repair-or-replacement assessment":`a windshield ${d.service.toLowerCase()}`;
    const briefText=`Cash-pay quote for ${serviceText} on a ${v.year} ${v.make} ${v.model} (${d.type.toLowerCase().replaceAll("_"," ")} damage near the ${d.location.toLowerCase().replaceAll("_"," ")}) in ZIP ${negotiation.intake.postalCode}.`;
    const chosen=[...negotiation.offers].filter(o=>o.providerId===providerId&&o.totals.statedAllInMinor!=null).sort((a,b)=>b.offerVersion-a.offerVersion)[0];
    const prompt=phase==="NEGOTIATION"?NEGOTIATION_PROMPT:phase==="CONFIRMATION"?confirmationPrompt({providerName:provider.name,vehicleLine:briefText,totalSpoken:chosen?.totals.statedAllInMinor!=null?`$${(chosen.totals.statedAllInMinor/100).toFixed(2)}`:null,schedulePreference:negotiation.intake.schedulePreference}):INTAKE_PROMPT;
    const result=await eleven<OutboundResult>("/convai/twilio/outbound-call",{method:"POST",body:JSON.stringify({
      agent_id:phase==="QUOTE_COLLECTION"?ids.buyer_intake:ids.buyer_negotiation,
      agent_phone_number_id:phoneId,
      to_number:provider.phoneNumber,
      conversation_initiation_client_data:{dynamic_variables:{call_id:callId,negotiation_id:negotiationId,provider_id:providerId,phase,allowed_concessions:"weekday/in-shop",call_brief_text:briefText},conversation_config_override:{agent:{prompt:{prompt}}}},
    })});
    if(!result.conversation_id)throw new Error(result.message||"ElevenLabs did not return a conversation ID");
    return recordCall(negotiationId,{callId,providerId,conversationId:result.conversation_id,twilioCallSid:result.callSid??null,phase,status:"IN_PROGRESS",outcome:null,reason:null});
  }catch(error){
    failCall(negotiationId,providerId,callId,error);
    throw error;
  }
}

export function failCall(negotiationId:string,providerId:string,callId:string,error:unknown){
  return recordCall(negotiationId,{callId,providerId,conversationId:null,status:"FAILED",outcome:"DROPPED",reason:error instanceof Error?error.message:String(error)});
}
