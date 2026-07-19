import { discoverSandboxProviders } from "./provider-search-service.js";
import { startElevenLabsCall } from "./elevenlabs-call-service.js";
import { applyBenchmarkContext, createSandboxNegotiation } from "./negotiation-service.js";
import { SandboxIntake } from "./domain.js";
import { benchmarkSandboxIntake } from "./benchmark-service.js";

export type CallStarter=typeof startElevenLabsCall;
export type BenchmarkRunner=typeof benchmarkSandboxIntake;

export function submitSandboxWorkflow(input:unknown,env:NodeJS.ProcessEnv=process.env,startCall:CallStarter=startElevenLabsCall,runBenchmark:BenchmarkRunner=benchmarkSandboxIntake){
  const request=SandboxIntake.parse(input),providers=discoverSandboxProviders(request.postalCode,env),negotiation=createSandboxNegotiation(request,providers[0]);
  void (async()=>{try{const result=await runBenchmark(request);applyBenchmarkContext(negotiation.negotiationId,result.benchmark,result.context)}catch(error){console.warn(`[sandbox benchmark ${negotiation.negotiationId}]`,error)}
    await startCall(negotiation.negotiationId,providers[0].providerId,"QUOTE_COLLECTION")})().catch(error=>console.error(`[sandbox workflow ${negotiation.negotiationId}]`,error));
  return negotiation;
}
