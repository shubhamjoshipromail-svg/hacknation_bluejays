import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { INTAKE_PROMPT, NEGOTIATION_PROMPT } from "./prompts.js";
import { getCallContext, recordCall } from "./negotiation-service.js";
import { eleven } from "./scripts/elevenlabs-api.js";
import { assertRealProviderEligible } from "./provider-consent-service.js";

type AgentIds={buyer_intake:string;buyer_negotiation:string};
type OutboundResult={success?:boolean;message?:string;conversation_id:string|null;callSid?:string|null};
type DeploymentManifest={controllerMode:"HOSTED_TOOLS"|"BACKEND_CUSTOM_LLM";controllerVersion:string;extractorPromptVersion:string;plannerPromptVersion:string;agentIds:AgentIds;agentVersions:Record<string,string|null>;publicBaseUrl:string;deployedAt:string};

function agents():AgentIds{
  if(!fs.existsSync("agents.json"))throw new Error("agents.json missing; run npm run provision");
  const value=JSON.parse(fs.readFileSync("agents.json","utf8")) as Partial<AgentIds>;
  if(!value.buyer_intake||!value.buyer_negotiation)throw new Error("sandbox buyer agents are not provisioned");
  return value as AgentIds;
}
function deployment():DeploymentManifest|null{if(!fs.existsSync("agent-deployment.json"))return null;return JSON.parse(fs.readFileSync("agent-deployment.json","utf8")) as DeploymentManifest}
function insideCallWindow(now=new Date()){const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(now);const value=Number(parts.find(p=>p.type==="hour")?.value??0)*60+Number(parts.find(p=>p.type==="minute")?.value??0);const parse=(text:string)=>{const [h,m]=text.split(":").map(Number);return h*60+m};return value>=parse(process.env.CALL_WINDOW_LOCAL_START??"09:00")&&value<parse(process.env.CALL_WINDOW_LOCAL_END??"17:00")}

export async function startElevenLabsCall(negotiationId:string,providerId:string,phase:"QUOTE_COLLECTION"|"NEGOTIATION"="QUOTE_COLLECTION"){
  const callMode=process.env.CALL_MODE??"SANDBOX";
  if(callMode==="REAL"){assertRealProviderEligible(providerId);if(!insideCallWindow())throw new Error("real call blocked outside the configured North Carolina call window")}
  else if(callMode!=="SANDBOX")throw new Error("CALL_MODE must be SANDBOX or REAL");
  const phoneId=process.env.ELEVENLABS_PHONE_NUMBER_ID;
  if(!process.env.ELEVENLABS_API_KEY||!phoneId)throw new Error("ElevenLabs sandbox calling is not configured");
  const callId=`call_${randomUUID()}`,manifest=deployment(),backend=process.env.CONVERSATION_CONTROLLER==="backend_custom_llm",expectedMode=backend?"BACKEND_CUSTOM_LLM":"HOSTED_TOOLS";
  if(backend&&!manifest)throw new Error("agent-deployment.json missing; provision backend-controlled agents first");
  if(manifest&&manifest.controllerMode!==expectedMode)throw new Error("deployed ElevenLabs controller mode does not match CONVERSATION_CONTROLLER");
  recordCall(negotiationId,{callId,providerId,conversationId:null,phase,status:"QUEUED",outcome:null,reason:null,controllerMode:expectedMode,deployment:manifest?{controllerVersion:manifest.controllerVersion,agentVersion:manifest.agentVersions[phase==="NEGOTIATION"?"buyer_negotiation":"buyer_intake"]??"unknown",extractorPromptVersion:manifest.extractorPromptVersion,plannerPromptVersion:manifest.plannerPromptVersion}:null});
  try{
    const {provider,call}=getCallContext(callId,providerId),ids=manifest?.agentIds??agents();
    const result=await eleven<OutboundResult>("/convai/twilio/outbound-call",{method:"POST",body:JSON.stringify({
      agent_id:phase==="NEGOTIATION"?ids.buyer_negotiation:ids.buyer_intake,
      agent_phone_number_id:phoneId,
      to_number:provider.phoneNumber,
      conversation_initiation_client_data:{environment:process.env.ELEVENLABS_ENVIRONMENT??"production",dynamic_variables:{call_id:callId,negotiation_id:negotiationId,provider_id:providerId,phase,attempt_number:String(call.attemptNumber),controller_version:manifest?.controllerVersion??"hosted",allowed_concessions:"weekday/in-shop"},custom_llm_extra_body:{call_id:callId,provider_id:providerId,attempt_number:call.attemptNumber,controller_version:manifest?.controllerVersion??"hosted",phase},...(backend?{}:{conversation_config_override:{agent:{prompt:{prompt:phase==="NEGOTIATION"?NEGOTIATION_PROMPT:INTAKE_PROMPT}}}})},
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
