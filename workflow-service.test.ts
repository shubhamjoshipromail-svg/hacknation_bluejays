import {beforeEach,describe,expect,it} from "vitest";
import {advanceSandboxWorkflow} from "./workflow-service.js";
import {attachOffer,createSandboxNegotiation,getNegotiation,recordCall} from "./negotiation-service.js";
import {discoverSandboxProviders} from "./provider-search-service.js";
import {resetStore} from "./store.js";

const intake={vehicle:{year:2021,make:"Volkswagen",model:"Tiguan",vin:null},damage:{service:"REPLACEMENT" as const,type:"CRACK" as const,location:"CENTER" as const,drivable:true},features:["FRONT_CAMERA" as const],postalCode:"28202",insuranceInvolved:false,schedulePreference:null};
const env={CALL_MODE:"SANDBOX",PERSONA_TO_NUMBER:"+15555550101",SANDBOX_PROVIDER_2_NAME:"Test Shop Two",SANDBOX_PROVIDER_2_NUMBER:"+15555550102",SANDBOX_PROVIDER_3_NAME:"Test Shop Three",SANDBOX_PROVIDER_3_NUMBER:"+15555550103"};
const offer=(providerId:string,total:number,callId:string)=>({quoteId:`quote_${providerId}`,providerId,callId,specRevision:1,offerVersion:1,stage:"INITIAL" as const,currency:"USD" as const,lineItems:[{category:"BASE_GLASS_AND_INSTALL" as const,rawLabel:"base",amountMinor:total-20000,status:"INCLUDED" as const,scope:{},provenanceIds:[`${providerId}_base`]},{category:"ADAS_CALIBRATION" as const,rawLabel:"calibration",amountMinor:15000,status:"INCLUDED" as const,scope:{},provenanceIds:[`${providerId}_adas`]},{category:"TAX" as const,rawLabel:"tax",amountMinor:5000,status:"INCLUDED" as const,scope:{},provenanceIds:[`${providerId}_tax`]}],totals:{statedAllInMinor:total,computedKnownMinor:total,taxStatus:"INCLUDED" as const,reconciliation:"MATCH" as const},terms:{validUntil:null,writtenConfirmation:true,warranty:"lifetime",appointmentWindow:"weekday"},comparability:"COMPARABLE" as const,redFlags:[]});
beforeEach(()=>resetStore());

describe("three-provider sandbox coordinator",()=>{
  it("loads the existing number plus providers two and three",()=>{const providers=discoverSandboxProviders("28202",env);expect(providers.map(p=>p.providerId)).toEqual(["sandbox_provider","sandbox_provider_2","sandbox_provider_3"]);expect(new Set(providers.map(p=>p.phoneNumber)).size).toBe(3)});
  it("runs quote calls sequentially, then negotiates the highest eligible quote once",async()=>{
    const providers=discoverSandboxProviders("28202",env),n=createSandboxNegotiation(intake,providers),started:Array<{providerId:string;phase:string;callId:string}>=[];
    const starter=async(negotiationId:string,providerId:string,phase:"QUOTE_COLLECTION"|"NEGOTIATION"="QUOTE_COLLECTION")=>{const callId=`call_${providerId}_${phase}`;started.push({providerId,phase,callId});return recordCall(negotiationId,{callId,providerId,conversationId:`conv_${callId}`,phase,status:"IN_PROGRESS",outcome:null,reason:null})};
    recordCall(n.negotiationId,{callId:"call_one",providerId:providers[0].providerId,conversationId:"conv_one",status:"COMPLETE",outcome:"QUOTED",reason:"done"});
    attachOffer(n.negotiationId,offer(providers[0].providerId,80000,"call_one"));
    await advanceSandboxWorkflow(n.negotiationId,starter);expect(started.at(-1)).toMatchObject({providerId:"sandbox_provider_2",phase:"QUOTE_COLLECTION"});
    recordCall(n.negotiationId,{callId:started.at(-1)!.callId,providerId:providers[1].providerId,conversationId:"conv_two",status:"COMPLETE",outcome:"QUOTED",reason:"done"});attachOffer(n.negotiationId,offer(providers[1].providerId,92000,started.at(-1)!.callId));
    await advanceSandboxWorkflow(n.negotiationId,starter);expect(started.at(-1)).toMatchObject({providerId:"sandbox_provider_3",phase:"QUOTE_COLLECTION"});
    recordCall(n.negotiationId,{callId:started.at(-1)!.callId,providerId:providers[2].providerId,conversationId:"conv_three",status:"COMPLETE",outcome:"QUOTED",reason:"done"});attachOffer(n.negotiationId,offer(providers[2].providerId,97500,started.at(-1)!.callId));
    await advanceSandboxWorkflow(n.negotiationId,starter);expect(started.at(-1)).toMatchObject({providerId:"sandbox_provider_3",phase:"NEGOTIATION"});
    const negotiationCall=started.at(-1)!;
    attachOffer(n.negotiationId,{...offer(providers[2].providerId,85000,negotiationCall.callId),quoteId:"quote_three_revised",offerVersion:2,stage:"NEGOTIATED" as const});
    recordCall(n.negotiationId,{callId:negotiationCall.callId,providerId:providers[2].providerId,conversationId:`conv_${negotiationCall.callId}`,phase:"NEGOTIATION",status:"COMPLETE",outcome:"QUOTED",reason:"Provider confirmed revised all-in offer"});
    const completed=await advanceSandboxWorkflow(n.negotiationId,starter);
    expect(started.filter(item=>item.phase==="NEGOTIATION")).toHaveLength(1);
    expect(completed.state).toBe("recommendation_ready");
    expect(completed.offers.some(item=>item.stage==="NEGOTIATED"&&item.totals.statedAllInMinor===85000)).toBe(true);
    expect(completed.recommendation?.offerId).toBeTruthy();
    expect(getNegotiation(n.negotiationId).benchmark.classification).toBe("VERIFIED");
  });
});
