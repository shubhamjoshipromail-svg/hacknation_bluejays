import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import { z } from "zod";
import { dispatchTool, TOOL_NAMES } from "./tools.js";
import { mutate, snapshot, store, type Turn } from "./store.js";
import { addDocument, addFollowUp, attachOffer, closeNegotiation, createNegotiation, createNegotiationFromVin, currentNegotiation, findNegotiationByCallId, getNegotiation, recommend, recordApproval, recordCall } from "./negotiation-service.js";
import { decodeVin } from "./vin-service.js";
import { advanceSandboxWorkflow, submitSandboxWorkflow, type CallStarter } from "./workflow-service.js";
import { startElevenLabsCall } from "./elevenlabs-call-service.js";

const MAX_WEBHOOK_AGE_SECONDS=30*60;
export function verifyElevenLabsSignature(raw:Buffer,header:string|undefined,secret:string,now=Math.floor(Date.now()/1000)){if(!header||!secret)return false;const fields=Object.fromEntries(header.split(",").map(part=>part.trim().split("=",2)));const timestamp=Number(fields.t);const supplied=fields.v0;if(!Number.isFinite(timestamp)||Math.abs(now-timestamp)>MAX_WEBHOOK_AGE_SECONDS||!supplied)return false;const expected=createHmac("sha256",secret).update(`${timestamp}.${raw.toString("utf8")}`).digest("hex");try{return timingSafeEqual(Buffer.from(supplied,"hex"),Buffer.from(expected,"hex"))}catch{return false}}

type WebhookTurn={id?:string;role?:"agent"|"user";message?:string;text?:string;time_in_call_secs?:number};
type WebhookEvent={type:string;event_timestamp?:number;data?:{conversation_id?:string;status?:string;failure_reason?:string;transcript?:WebhookTurn[];conversation_initiation_client_data?:{dynamic_variables?:Record<string,string>}}};
function ingestWebhook(event:WebhookEvent,startCall:CallStarter=startElevenLabsCall){
  const data=event.data??{},conversationId=String(data.conversation_id??""),vars=data.conversation_initiation_client_data?.dynamic_variables??{},callId=vars.call_id??conversationId,providerId=vars.provider_id??"UNKNOWN";
  if(event.type==="call_initiation_failure"){
    try{const n=findNegotiationByCallId(callId);recordCall(n.negotiationId,{callId,providerId,conversationId:conversationId||null,status:"FAILED",outcome:"DROPPED",reason:`call initiation failure: ${data.failure_reason??"unknown"}`});void advanceSandboxWorkflow(n.negotiationId,startCall).catch(error=>console.error(`[sandbox advance ${n.negotiationId}]`,error))}
    catch{mutate(s=>s.outcomes.push({callId,providerId,outcome:"DROPPED",reason:`call initiation failure: ${data.failure_reason??"unknown"}`,quoteId:null,callbackWindow:null,endedAt:new Date().toISOString()}))}
    return;
  }
  if(event.type!=="post_call_transcription")return;
  try{
    const n=findNegotiationByCallId(callId),call=n.calls.find(c=>c.callId===callId)!;
    const outcome=call.outcome??"DROPPED",reason=call.reason??(data.status==="done"?"conversation ended without close_call":`conversation ended with status ${data.status??"unknown"}`);
    recordCall(n.negotiationId,{callId,providerId,conversationId:conversationId||call.conversationId,status:data.status==="done"?"COMPLETE":"FAILED",outcome,reason,endedAt:new Date().toISOString(),transcript:data.transcript??[]});
    const finalTexts=(data.transcript??[]).map(t=>String(t.message??t.text??""));
    for(const quote of n.offers.filter(q=>q.callId===callId))for(const item of quote.lineItems)for(const provenanceId of item.provenanceIds){
      const p=n.evidence.find(e=>e.provenanceId===provenanceId);
      if(p&&!finalTexts.some(t=>t.includes(p.transcriptExcerpt)||p.transcriptExcerpt.includes(t)))mutate(()=>store.negotiations[n.negotiationId].redFlags.push({code:"TRANSCRIPT_EVIDENCE_MISMATCH",severity:"HIGH",detail:`${quote.quoteId}/${item.category} evidence was not found in the final transcript`}));
    }
    void advanceSandboxWorkflow(n.negotiationId,startCall).catch(error=>console.error(`[sandbox advance ${n.negotiationId}]`,error));
  }catch(error){console.warn(`[WEBHOOK_UNMATCHED] ${callId}:`,error)}
}

function jsonBody(body:unknown){if(Buffer.isBuffer(body))return JSON.parse(body.toString("utf8"));return body}
export function buildServer(env:NodeJS.ProcessEnv=process.env,deps:{startCall?:CallStarter}={}){const app=Fastify({logger:false,bodyLimit:1_000_000});app.addContentTypeParser("application/json",{parseAs:"buffer"},(_req,body,done)=>done(null,body));app.addHook("onSend",async(_req,reply,payload)=>{reply.header("access-control-allow-origin",env.FRONTEND_ORIGIN??"*");reply.header("access-control-allow-headers","content-type,x-tool-secret");reply.header("access-control-allow-methods","GET,POST,OPTIONS");return payload});app.options("*",async(_req,reply)=>reply.code(204).send());
  app.post<{Params:{toolName:string}}>("/tools/:toolName",async(req,reply)=>{const started=performance.now();if(req.headers["x-tool-secret"]!==env.TOOL_SHARED_SECRET)return reply.code(401).send({error:"unauthorized"});if(!TOOL_NAMES.includes(req.params.toolName as typeof TOOL_NAMES[number]))return reply.code(404).send({error:"unknown tool"});try{const raw=req.body as Buffer;const args=JSON.parse(raw.toString("utf8"));const result=dispatchTool(req.params.toolName,args);reply.header("server-timing",`tool;dur=${(performance.now()-started).toFixed(1)}`);return{ok:true,result}}catch(error){req.log.error(error);return reply.code(400).send({error:error instanceof Error?error.message:"tool failed",fallback:"Let me double-check and follow up."})}});
  app.post("/webhooks/elevenlabs",async(req,reply)=>{const raw=req.body as Buffer;const secret=env.ELEVENLABS_WEBHOOK_SECRET??env.TOOL_SHARED_SECRET??"";if(!verifyElevenLabsSignature(raw,req.headers["elevenlabs-signature"] as string|undefined,secret))return reply.code(401).send({error:"invalid or stale signature"});try{ingestWebhook(JSON.parse(raw.toString("utf8")),deps.startCall??startElevenLabsCall);return{status:"received"}}catch{return reply.code(400).send({error:"invalid webhook"})}});
  app.setErrorHandler((error,_req,reply)=>{const message=error instanceof Error?error.message:"request failed";const status=error instanceof z.ZodError?422:message.includes("not found")?404:message.includes("required")||message.includes("before")?409:400;return reply.code(status).send({error:error instanceof z.ZodError?"validation failed":message,issues:error instanceof z.ZodError?error.issues:undefined})});
  app.post("/api/negotiations",async req=>createNegotiation(jsonBody(req.body)));
  app.post("/api/runs",async(req,reply)=>reply.code(202).send(submitSandboxWorkflow(jsonBody(req.body),env,deps.startCall??startElevenLabsCall)));
  app.get<{Params:{vin:string}}>("/api/vin/:vin",async req=>decodeVin(req.params.vin));
  app.post("/api/negotiations/from-vin",async req=>createNegotiationFromVin(jsonBody(req.body)));
  app.get<{Params:{id:string}}>("/api/negotiations/:id",async req=>getNegotiation(req.params.id));
  app.get("/api/negotiations/current",async(_req,reply)=>{const n=currentNegotiation();return n??reply.code(404).send({error:"no current negotiation"})});
  app.post<{Params:{id:string}}>("/api/negotiations/:id/documents",async req=>{const b=z.object({documentText:z.string(),label:z.string().optional()}).parse(jsonBody(req.body));return addDocument(req.params.id,b.documentText,b.label)});
  app.post<{Params:{id:string}}>("/api/negotiations/:id/approvals",async req=>{const b=z.object({action:z.enum(["CONFIRM_SPEC","START_CALLS","MAKE_COUNTEROFFER","ACCEPT_OFFER","SHARE_SENSITIVE_INFO","CONFIRM_AGREEMENT"]),details:z.string().min(1)}).parse(jsonBody(req.body));return recordApproval(req.params.id,b.action,b.details)});
  app.post<{Params:{id:string}}>("/api/negotiations/:id/offers",async req=>attachOffer(req.params.id,jsonBody(req.body)));
  app.post<{Params:{id:string}}>("/api/negotiations/:id/recommendation",async req=>recommend(req.params.id));
  app.post<{Params:{id:string}}>("/api/negotiations/:id/follow-ups",async req=>{const b=z.object({idempotencyKey:z.string().min(1),dueAt:z.string().datetime(),note:z.string().min(1)}).parse(jsonBody(req.body));return addFollowUp(req.params.id,b)});
  app.post<{Params:{id:string}}>("/api/negotiations/:id/close",async req=>{const b=z.object({outcome:z.enum(["accepted","walked_away","closed"])}).parse(jsonBody(req.body));return closeNegotiation(req.params.id,b.outcome)});
  app.get("/runs/current",async()=>({negotiation:currentNegotiation(),legacy:snapshot()}));app.get("/health",async()=>({ok:true,service:"the-negotiator",storeLoaded:true}));return app}
if(import.meta.url===`file://${process.argv[1]}`){const port=Number(process.env.PORT??3000);buildServer().listen({port,host:"0.0.0.0"}).then(()=>console.log(`Tool server listening on :${port}`)).catch(error=>{console.error(error);process.exit(1)})}
