import { discoverSandboxProviders } from "./provider-search-service.js";
import { startElevenLabsCall } from "./elevenlabs-call-service.js";
import { applyBenchmarkContext, createSandboxNegotiation, getNegotiation, recommend } from "./negotiation-service.js";
import { SandboxIntake } from "./domain.js";
import { benchmarkSandboxIntake } from "./benchmark-service.js";

export type CallStarter=typeof startElevenLabsCall;
export type BenchmarkRunner=typeof benchmarkSandboxIntake;

export async function advanceSandboxWorkflow(negotiationId:string,startCall:CallStarter=startElevenLabsCall){
  const n=getNegotiation(negotiationId),quoteCalls=n.calls.filter(c=>c.phase==="QUOTE_COLLECTION");
  if(quoteCalls.some(c=>c.status==="QUEUED"||c.status==="IN_PROGRESS"))return n;
  const uncalled=n.providers.find(provider=>!quoteCalls.some(call=>call.providerId===provider.providerId));
  if(uncalled)return startCall(negotiationId,uncalled.providerId,"QUOTE_COLLECTION");
  const negotiationCall=n.calls.find(c=>c.phase==="NEGOTIATION");
  if(negotiationCall){if(negotiationCall.status==="COMPLETE"||negotiationCall.status==="FAILED")return n.offers.length?recommend(negotiationId):getNegotiation(negotiationId);return n}
  const comparable=n.offers.filter(o=>o.stage==="INITIAL"&&o.comparability==="COMPARABLE"&&o.totals.reconciliation==="MATCH"&&o.totals.statedAllInMinor!=null).sort((a,b)=>b.totals.statedAllInMinor!-a.totals.statedAllInMinor!);
  if(n.offers.length)recommend(negotiationId);
  const target=comparable.find(candidate=>comparable.some(other=>other.providerId!==candidate.providerId&&other.totals.statedAllInMinor!<candidate.totals.statedAllInMinor!));
  return target?startCall(negotiationId,target.providerId,"NEGOTIATION"):getNegotiation(negotiationId);
}

export function submitSandboxWorkflow(input:unknown,env:NodeJS.ProcessEnv=process.env,startCall:CallStarter=startElevenLabsCall,runBenchmark:BenchmarkRunner=benchmarkSandboxIntake){
  const request=SandboxIntake.parse(input),providers=discoverSandboxProviders(request.postalCode,env),negotiation=createSandboxNegotiation(request,providers);
  void (async()=>{try{const result=await runBenchmark(request);applyBenchmarkContext(negotiation.negotiationId,result.benchmark,result.context)}catch(error){console.warn(`[sandbox benchmark ${negotiation.negotiationId}]`,error)}
    await startCall(negotiation.negotiationId,providers[0].providerId,"QUOTE_COLLECTION")})().catch(error=>console.error(`[sandbox workflow ${negotiation.negotiationId}]`,error));
  return negotiation;
}
