import { beforeEach,describe,expect,it } from "vitest";
import { createSandboxNegotiation,getNegotiation,recordCall } from "./negotiation-service.js";
import { dispatchTool } from "./tools.js";
import { resetStore } from "./store.js";

const provider={providerId:"sandbox_provider",name:"Sandbox Provider",phoneNumber:"+15555550123",locationLabel:"Sandbox",source:"SANDBOX_CONFIG" as const,verified:true};
const intake=(frontCamera=true)=>({vehicle:{year:2021,make:"Volkswagen",model:"Tiguan",vin:null},damage:{service:"NOT_SURE" as const,type:"CRACK" as const,location:"CENTER" as const,drivable:true},features:frontCamera?["FRONT_CAMERA" as const]:[],postalCode:"28202",insuranceInvolved:false,schedulePreference:null});
function setup(frontCamera=true){const n=createSandboxNegotiation(intake(frontCamera),provider);recordCall(n.negotiationId,{callId:"call_smart",providerId:provider.providerId,conversationId:"conv_smart",status:"IN_PROGRESS",outcome:null,reason:null});return n.negotiationId}
const args=(turn_id:string,turn_text:string,facts:unknown[],question_topic:string|null=null)=>({call_id:"call_smart",provider_id:provider.providerId,conversation_id:"conv_smart",turn_id,turn_text,facts,question_topic});
beforeEach(()=>resetStore());

describe("adaptive call intelligence",()=>{
  it("captures an out-of-order information dump and closes a reconciled quote",()=>{
    const id=setup();
    const state=dispatchTool("record_provider_answer",args("turn_all","Replacement is $800, dynamic calibration is $150, tax is $50, total $1,000 with OEE glass and a lifetime warranty.",[
      {key:"SERVICE_RECOMMENDATION",status:"KNOWN",value:"replacement"},{key:"BASE_PRICE",status:"KNOWN",value:"glass and installation",amount_minor:80000,item_status:"INCLUDED"},{key:"ADAS_INCLUDED",status:"KNOWN",value:"included",item_status:"INCLUDED"},{key:"ADAS_TYPE",status:"KNOWN",value:"dynamic"},{key:"ADAS_PRICE",status:"KNOWN",value:"dynamic calibration",amount_minor:15000,item_status:"INCLUDED"},{key:"TAX",status:"KNOWN",value:"sales tax",amount_minor:5000,item_status:"INCLUDED"},{key:"TOTAL",status:"KNOWN",value:"all-in total",amount_minor:100000},{key:"GLASS_TYPE",status:"KNOWN",value:"OEE"},{key:"WARRANTY",status:"KNOWN",value:"lifetime"},
    ])) as {canClose:boolean;criticalGaps:string[]};
    expect(state).toMatchObject({canClose:true,criticalGaps:[]});
    const closed=dispatchTool("close_call",{call_id:"call_smart",provider_id:provider.providerId,conversation_id:"conv_smart",outcome:"QUOTED",reason:"Provider confirmed the usable all-in quote"}) as {quoteId:string};
    const run=getNegotiation(id),quote=run.offers.find(q=>q.quoteId===closed.quoteId)!;
    expect(quote.totals).toMatchObject({statedAllInMinor:100000,computedKnownMinor:100000,reconciliation:"MATCH",taxStatus:"INCLUDED"});
    expect(quote.lineItems).toHaveLength(3);
  });

  it("does not duplicate a repeated fact or confuse a paraphrase with a correction",()=>{
    const id=setup();
    dispatchTool("record_provider_answer",args("t1","Glass and installation is $800.",[{key:"BASE_PRICE",status:"KNOWN",value:"glass and installation",amount_minor:80000,item_status:"INCLUDED"}],"BASE_PRICE"));
    const state=dispatchTool("record_provider_answer",args("t2","Yes, eight hundred for the base job.",[{key:"BASE_PRICE",status:"KNOWN",value:"base job",amount_minor:80000,item_status:"INCLUDED"}],"BASE_PRICE")) as {contradictions:unknown[]};
    const call=getNegotiation(id).calls[0];
    expect(state.contradictions).toHaveLength(0);
    expect(call.draft?.lineItems.filter(i=>i.category==="BASE_GLASS_AND_INSTALL")).toHaveLength(1);
    expect(call.intelligence?.facts.filter(f=>f.key==="BASE_PRICE")).toHaveLength(1);
  });

  it("surfaces conflicting money and accepts only an explicit correction",()=>{
    setup();
    dispatchTool("record_provider_answer",args("t1","The total is $1,000.",[{key:"TOTAL",status:"KNOWN",value:"total",amount_minor:100000}]));
    const conflict=dispatchTool("record_provider_answer",args("t2","Actually it is $1,100.",[{key:"TOTAL",status:"KNOWN",value:"revised total",amount_minor:110000}])) as {canClose:boolean;completionStatus:string;contradictions:Array<{resolved:boolean}>};
    expect(conflict).toMatchObject({canClose:false,completionStatus:"NEEDS_ONE_CLARIFICATION"});
    const resolved=dispatchTool("record_provider_answer",args("t3","Confirmed, $1,100 is the final total.",[{key:"TOTAL",status:"KNOWN",value:"confirmed final total",amount_minor:110000,confirmed_correction:true}])) as {canClose:boolean;contradictions:Array<{resolved:boolean}>};
    expect(resolved.canClose).toBe(true);
    expect(resolved.contradictions.every(c=>c.resolved)).toBe(true);
  });

  it("uses an interruption to resolve volunteered topics without asking them again",()=>{
    setup();
    const state=dispatchTool("record_provider_answer",args("interrupt","Before you ask, the $900 total includes $50 tax.",[{key:"TOTAL",status:"KNOWN",value:"all-in",amount_minor:90000},{key:"TAX",status:"KNOWN",value:"included tax",amount_minor:5000,item_status:"INCLUDED"}],"BASE_PRICE")) as {askedTopics:string[];criticalGaps:string[];recommendedGoals:Array<{key:string}>};
    expect(state.askedTopics).toContain("BASE_PRICE");
    expect(state.criticalGaps).not.toContain("TOTAL");
    expect(state.criticalGaps).not.toContain("TAX");
    expect(state.recommendedGoals.map(g=>g.key)).not.toContain("TAX");
  });

  it("does not require ADAS questions when the intake establishes no front camera",()=>{
    setup(false);
    const state=dispatchTool("get_call_state",{call_id:"call_smart",provider_id:provider.providerId,conversation_id:"conv_smart"}) as {criticalGaps:string[]};
    expect(state.criticalGaps.some(k=>k.startsWith("ADAS"))).toBe(false);
  });
});
