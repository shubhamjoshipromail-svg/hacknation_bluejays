import fs from "node:fs";
import { runBenchmarkPipeline } from "./benchmarking/src/pipeline.js";
import { toBackendBenchmark } from "./benchmarking/src/decision.js";
import type { BenchmarkHandoff, BenchmarkRequest, CallQuoteObservation } from "./benchmarking/src/contracts.js";
import type { Benchmark, BenchmarkContext, QuoteOffer, SandboxIntake } from "./domain.js";

const fixture=(name:string)=>fs.readFileSync(new URL(`./benchmarking/fixtures/${name}`,import.meta.url),"utf8");

export async function benchmarkSandboxIntake(input:SandboxIntake):Promise<{benchmark:Benchmark;context:BenchmarkContext;handoff:BenchmarkHandoff}>{
  const frontCamera=input.features.includes("FRONT_CAMERA")?true:input.features.includes("NOT_SURE")?undefined:false;
  const request:BenchmarkRequest={postalCode:input.postalCode,service:input.damage.service,frontCamera,vehicle:{...input.vehicle}};
  const handoff=await runBenchmarkPipeline(request,{
    skipProviders:true,
    skipVehiclePricing:true,
    offlineBodies:{"aaa-windshield-costs":fixture("aaa-costs.html"),"aaa-adas-study":fixture("aaa-adas.txt")},
  });
  const evidence=[...handoff.strongEvidence,...handoff.directionalEvidence].map(signal=>({
    signalId:signal.signalId,kind:signal.kind,label:signal.label,lowMinor:signal.lowMinor,typicalMinor:signal.typicalMinor,highMinor:signal.highMinor,
    strength:signal.evidence.strength,publisher:signal.evidence.publisher,url:signal.evidence.url,excerpt:signal.evidence.excerpt,
  }));
  const benchmark=toBackendBenchmark(handoff),snapshotWarning="Published evidence is a bundled source-derived snapshot; refresh the standalone benchmark vertical before production decisions.";
  benchmark.notes.unshift(snapshotWarning);
  return {benchmark,handoff,context:{schemaVersion:"1.0",generatedAt:handoff.generatedAt,expectedRangeMinor:handoff.callGuidance.expectedRangeMinor,requiredQuestions:handoff.callGuidance.requiredQuestions,warnings:[snapshotWarning,...handoff.callGuidance.warnings],evidence,liveQuoteSampleSize:handoff.liveQuoteBenchmark?.sampleSize??0}};
}

export function quoteObservation(quote:QuoteOffer,service:"REPAIR"|"REPLACEMENT"|"NOT_SURE"):CallQuoteObservation|null{
  if(quote.stage!=="INITIAL"||service==="NOT_SURE")return null;
  return {observationId:quote.quoteId,providerId:quote.providerId,capturedAt:new Date().toISOString(),service,statedAllInMinor:quote.totals.statedAllInMinor,
    lineItems:quote.lineItems.filter(i=>i.category!=="DISCOUNT").map(i=>({category:i.category,amountMinor:i.amountMinor,status:i.status==="NOT_APPLICABLE"?"EXCLUDED":i.status})),
    sameVehicleAndScope:quote.comparability==="COMPARABLE",totalReconciles:quote.totals.reconciliation==="MATCH",provenanceRef:quote.lineItems.flatMap(i=>i.provenanceIds)[0]??quote.callId};
}
