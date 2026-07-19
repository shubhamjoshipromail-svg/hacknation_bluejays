import { discoverSandboxProviders } from "./provider-search-service.js";
import { startElevenLabsCall } from "./elevenlabs-call-service.js";
import { createSandboxNegotiation } from "./negotiation-service.js";

export type CallStarter=typeof startElevenLabsCall;

export function submitSandboxWorkflow(input:unknown,env:NodeJS.ProcessEnv=process.env,startCall:CallStarter=startElevenLabsCall){
  const postalCode=typeof input==="object"&&input!==null&&"postalCode" in input?String(input.postalCode):"";
  const providers=discoverSandboxProviders(postalCode,env),negotiation=createSandboxNegotiation(input,providers[0]);
  void startCall(negotiation.negotiationId,providers[0].providerId,"QUOTE_COLLECTION").catch(error=>{
    console.error(`[sandbox workflow ${negotiation.negotiationId}]`,error);
  });
  return negotiation;
}
