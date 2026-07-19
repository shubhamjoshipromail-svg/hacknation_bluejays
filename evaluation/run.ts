import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createSandboxNegotiation, recommend, recordCall } from "../negotiation-service.js";
import { resetStore, store } from "../store.js";
import { runDriver, runNegotiationDriver, type DriverMode, type Scenario } from "./harness.js";
import { evaluateNegotiation, evaluateScenario, type CheckResult } from "./checks.js";

const EVALUATOR_VERSION="1.0.0";
const provider={providerId:"sandbox_eval",name:"Evaluation Sandbox Shop",phoneNumber:"+15555550100",locationLabel:"Eval Sandbox",source:"SANDBOX_CONFIG" as const,verified:true};
// Obviously synthetic vehicle; the fixed job specification every scenario reuses.
const intakeFor=(s:Scenario)=>({vehicle:{year:2021,make:"Volkswagen",model:"Tiguan",vin:null},damage:{service:s.intake.service??"NOT_SURE",type:"CRACK" as const,location:"CENTER" as const,drivable:true},features:s.intake.features??["FRONT_CAMERA" as const],postalCode:"28202",insuranceInvolved:false,schedulePreference:s.intake.schedulePreference??null});

type RunReport={scenarioId:string;scenarioVersion:number;name:string;driver:DriverMode;seeded:boolean;outcome:string|null;reason:string|null;statedTotalMinor:number|null;reconciliation:string|null;providerTurns:number;checks:CheckResult[];transcript:Array<{turnId:string;speaker:string;text:string}>;};

function loadScenarios():Scenario[]{
  const dir=path.resolve("evaluation/scenarios/training");
  return fs.readdirSync(dir).filter(f=>f.endsWith(".json")).sort().map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),"utf8")) as Scenario);
}

function runOne(scenario:Scenario,driver:DriverMode,seeded:boolean):RunReport{
  resetStore();
  const callId=`call_eval_${scenario.id}`,conversationId=`conv_eval_${scenario.id}`;
  const n=createSandboxNegotiation(intakeFor(scenario),provider) as {negotiationId:string};
  recordCall(n.negotiationId,{callId,providerId:provider.providerId,conversationId,status:"IN_PROGRESS",outcome:null,reason:null});
  const result=runDriver(scenario,{callId,providerId:provider.providerId,conversationId},driver);
  try{recommend(n.negotiationId)}catch{/* recommendation is optional for evaluation runs */}
  const checks=evaluateScenario(scenario,n.negotiationId,callId,result.closeError,seeded);
  const raw=store.negotiations[n.negotiationId],call=raw.calls.find(c=>c.callId===callId)!,quote=raw.offers.find(o=>o.callId===callId)??null;
  return {scenarioId:scenario.id,scenarioVersion:scenario.version,name:scenario.name,driver,seeded,outcome:call.outcome,reason:call.reason,statedTotalMinor:quote?.totals.statedAllInMinor??null,reconciliation:quote?.totals.reconciliation??null,providerTurns:result.providerTurns,checks,transcript:call.transcript.map(t=>({turnId:t.turnId,speaker:t.speaker,text:t.text}))};
}

function runNegotiationScenario(scenario:Scenario):RunReport{
  resetStore();
  const providers=scenario.providers!.map(p=>({providerId:p.providerId,name:p.displayName,phoneNumber:"+15555550100",locationLabel:"Eval Sandbox",source:"SANDBOX_CONFIG" as const,verified:true}));
  const n=createSandboxNegotiation(intakeFor(scenario),providers) as {negotiationId:string};
  for(const p of scenario.providers!){
    const callId=`call_eval_${scenario.id}_${p.providerId}`,conversationId=`conv_eval_${scenario.id}_${p.providerId}`;
    recordCall(n.negotiationId,{callId,providerId:p.providerId,conversationId,status:"IN_PROGRESS",outcome:null,reason:null});
    runDriver({...scenario,id:`${scenario.id}_${p.providerId}`,shop:{displayName:p.displayName,responses:p.responses}},{callId,providerId:p.providerId,conversationId},"adaptive");
  }
  const negoCallId=`call_eval_${scenario.id}_nego`,negoConvId=`conv_eval_${scenario.id}_nego`;
  recordCall(n.negotiationId,{callId:negoCallId,providerId:scenario.negotiation!.target,conversationId:negoConvId,phase:"NEGOTIATION",status:"IN_PROGRESS",outcome:null,reason:null});
  const result=runNegotiationDriver(scenario,{callId:negoCallId,providerId:scenario.negotiation!.target,conversationId:negoConvId});
  try{recommend(n.negotiationId)}catch{/* recommendation is optional for evaluation runs */}
  const checks=evaluateNegotiation(scenario,n.negotiationId,negoCallId,result);
  const raw=store.negotiations[n.negotiationId],call=raw.calls.find(c=>c.callId===negoCallId)!,quote=raw.offers.find(o=>o.quoteId===result.negotiatedQuoteId)??null;
  return {scenarioId:scenario.id,scenarioVersion:scenario.version,name:scenario.name,driver:"adaptive",seeded:false,outcome:call.outcome,reason:call.reason,statedTotalMinor:quote?.totals.statedAllInMinor??null,reconciliation:quote?.totals.reconciliation??null,providerTurns:0,checks,transcript:call.transcript.map(t=>({turnId:t.turnId,speaker:t.speaker,text:t.text}))};
}

function runSuite(scenarios:Scenario[]):RunReport[]{
  const reports=scenarios.map(s=>s.mode==="NEGOTIATION"?runNegotiationScenario(s):runOne(s,"adaptive",false));
  const seededTarget=scenarios.find(s=>s.id==="PRICE-02");
  if(seededTarget)reports.push(runOne(seededTarget,"naive",true));
  return reports;
}

function main(){
  const scenarios=loadScenarios();
  const first=runSuite(scenarios);
  const second=runSuite(scenarios);
  const signature=(rs:RunReport[])=>JSON.stringify(rs.map(r=>[r.scenarioId,r.driver,r.outcome,r.statedTotalMinor,r.checks.map(c=>[c.check_id,c.status])]));
  const deterministic=signature(first)===signature(second);
  const commit=execSync("git rev-parse HEAD").toString().trim();
  const promptHash=createHash("sha256").update(fs.readFileSync("prompts.ts")).update(fs.readFileSync("call-intelligence.ts")).digest("hex").slice(0,16);
  const summary={runId:`eval_${new Date().toISOString().replaceAll(/[:.]/g,"-")}_${randomUUID().slice(0,8)}`,startedAt:new Date().toISOString(),commit,promptHash,evaluatorVersion:EVALUATOR_VERSION,deterministicAcrossTwoRuns:deterministic,reports:first};
  fs.mkdirSync("evaluation/reports",{recursive:true});
  const outPath=path.join("evaluation/reports",`${summary.runId}.json`);
  fs.writeFileSync(outPath,JSON.stringify(summary,null,2));

  let criticalFailures=0;
  console.log(`\nEVALUATION BASELINE  commit=${commit.slice(0,7)}  promptHash=${promptHash}  evaluator=${EVALUATOR_VERSION}`);
  console.log(`deterministic across two full runs: ${deterministic}\n`);
  for(const r of first){
    const failed=r.checks.filter(c=>c.status==="FAIL");
    criticalFailures+=failed.filter(c=>c.severity==="critical"&&!r.seeded).length;
    console.log(`${r.seeded?"[SEEDED-FAILURE] ":""}${r.scenarioId} v${r.scenarioVersion} (${r.driver}) -> ${r.outcome} total=${r.statedTotalMinor??"-"} recon=${r.reconciliation??"-"} turns=${r.providerTurns}  checks ${r.checks.length-failed.length}/${r.checks.length} pass`);
    for(const c of failed)console.log(`   FAIL [${c.severity}] ${c.check_id}: expected ${c.expected}; observed ${c.observed}`);
  }
  console.log(`\nReport written to ${outPath}`);
  console.log(criticalFailures?`\nBaseline has ${criticalFailures} unseeded critical check failure(s) - candidates for Phase B diagnosis.`:"\nAll unseeded checks pass.");
}

main();
