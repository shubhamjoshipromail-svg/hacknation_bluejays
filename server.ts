import "dotenv/config";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import { z } from "zod";
import { dispatchTool, recoverCompletedQuote, TOOL_NAMES } from "./tools.js";
import { mutate, snapshot, store, type Turn } from "./store.js";
import {
  addDocument,
  addFollowUp,
  attachOffer,
  closeNegotiation,
  createNegotiation,
  createNegotiationFromVin,
  currentNegotiation,
  findNegotiationByCallId,
  getNegotiation,
  getCallContext,
  recommend,
  recordApproval,
  recordCall,
} from "./negotiation-service.js";
import { decodeVin } from "./vin-service.js";
import {
  advanceSandboxWorkflow,
  retrySandboxNegotiation,
  submitSandboxWorkflow,
  type CallStarter,
} from "./workflow-service.js";
import { startElevenLabsCall } from "./elevenlabs-call-service.js";
import { createConversationController, parseCustomLlmRequest, type ControllerResult } from "./conversation-controller.js";
import { registerOptedInProvider, revokeProviderConsent, eligibleRealProviders } from "./provider-consent-service.js";
import { purgeExpiredCallEvidence } from "./retention-service.js";

const MAX_WEBHOOK_AGE_SECONDS = 30 * 60;
export function verifyElevenLabsSignature(
  raw: Buffer,
  header: string | undefined,
  secret: string,
  now = Math.floor(Date.now() / 1000),
) {
  if (!header || !secret) return false;
  const fields = Object.fromEntries(
    header.split(",").map((part) => part.trim().split("=", 2)),
  );
  const timestamp = Number(fields.t);
  const supplied = fields.v0;
  if (
    !Number.isFinite(timestamp) ||
    Math.abs(now - timestamp) > MAX_WEBHOOK_AGE_SECONDS ||
    !supplied
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${raw.toString("utf8")}`)
    .digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(supplied, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

type WebhookTurn = {
  id?: string;
  role?: "agent" | "user";
  message?: string;
  text?: string;
  time_in_call_secs?: number;
};
type WebhookEvent = {
  type: string;
  event_timestamp?: number;
  data?: {
    conversation_id?: string;
    status?: string;
    failure_reason?: string;
    version_id?: string;
    transcript?: WebhookTurn[];
    conversation_initiation_client_data?: {
      dynamic_variables?: Record<string, string>;
    };
  };
};
async function ingestWebhook(
  event: WebhookEvent,
  startCall: CallStarter = startElevenLabsCall,
  controller: ReturnType<typeof createConversationController> | null = null,
) {
  const data = event.data ?? {},
    conversationId = String(data.conversation_id ?? ""),
    vars = data.conversation_initiation_client_data?.dynamic_variables ?? {},
    callId = vars.call_id ?? conversationId,
    providerId = vars.provider_id ?? "UNKNOWN";
  if (event.type === "call_initiation_failure") {
    try {
      const n = findNegotiationByCallId(callId);
      recordCall(n.negotiationId, {
        callId,
        providerId,
        conversationId: conversationId || null,
        status: "FAILED",
        outcome: "DROPPED",
        reason: `call initiation failure: ${data.failure_reason ?? "unknown"}`,
      });
      void advanceSandboxWorkflow(n.negotiationId, startCall).catch((error) =>
        console.error(`[sandbox advance ${n.negotiationId}]`, error),
      );
    } catch {
      mutate((s) =>
        s.outcomes.push({
          callId,
          providerId,
          outcome: "DROPPED",
          reason: `call initiation failure: ${data.failure_reason ?? "unknown"}`,
          quoteId: null,
          callbackWindow: null,
          endedAt: new Date().toISOString(),
        }),
      );
    }
    return;
  }
  if (event.type !== "post_call_transcription") return;
  try {
    const n = findNegotiationByCallId(callId),
      call = n.calls.find((c) => c.callId === callId)!;
    recordCall(n.negotiationId, {
      callId,
      providerId,
      conversationId: conversationId || call.conversationId,
      status: data.status === "done" ? "COMPLETE" : "FAILED",
      outcome: call.outcome,
      reason: call.reason,
      endedAt: new Date().toISOString(),
      transcript: data.transcript ?? [],
    });
    const persisted = findNegotiationByCallId(callId).calls.find((item) => item.callId === callId)!;
    if (!persisted.isActiveAttempt) return;
    if (persisted.deployment?.agentVersion && data.version_id && persisted.deployment.agentVersion !== data.version_id) {
      mutate(() => {
        const current = getCallContext(callId).call;
        current.status = "FAILED";
        current.outcome = "DROPPED";
        current.reason = `agent version mismatch: expected ${persisted.deployment!.agentVersion}, received ${data.version_id}`;
        getCallContext(callId).negotiation.redFlags.push({ code: "AGENT_VERSION_MISMATCH", severity: "HIGH", detail: current.reason });
      });
      return;
    }
    if (!call.outcome && data.status === "done" && controller) {
      const providerTurns = findNegotiationByCallId(callId).calls.find((item) => item.callId === callId)!.transcript
        .filter((turn) => turn.speaker === "SHOP")
        .map((turn) => ({ turnId: turn.turnId, text: turn.text }));
      await controller.reconcileTranscript({ callId, providerId, turns: providerTurns });
    }
    if (!findNegotiationByCallId(callId).calls.find((c) => c.callId === callId)!.outcome && data.status === "done")
      recoverCompletedQuote(callId, providerId);
    const refreshed = findNegotiationByCallId(callId).calls.find(
      (c) => c.callId === callId,
    )!;
    const outcome = refreshed.outcome ?? "DROPPED",
      reason =
        refreshed.reason ??
        (data.status === "done"
          ? "conversation ended without close_call"
          : `conversation ended with status ${data.status ?? "unknown"}`);
    recordCall(n.negotiationId, {
      callId,
      providerId,
      conversationId: conversationId || call.conversationId,
      status: data.status === "done" ? "COMPLETE" : "FAILED",
      outcome,
      reason,
      endedAt: new Date().toISOString(),
      transcript: data.transcript ?? [],
    });
    const finalTexts = (data.transcript ?? []).map((t) =>
      String(t.message ?? t.text ?? ""),
    );
    for (const quote of n.offers.filter((q) => q.callId === callId))
      for (const item of quote.lineItems)
        for (const provenanceId of item.provenanceIds) {
          const p = n.evidence.find((e) => e.provenanceId === provenanceId);
          if (
            p &&
            !finalTexts.some(
              (t) =>
                t.includes(p.transcriptExcerpt) ||
                p.transcriptExcerpt.includes(t),
            )
          )
            mutate(() =>
              store.negotiations[n.negotiationId].redFlags.push({
                code: "TRANSCRIPT_EVIDENCE_MISMATCH",
                severity: "HIGH",
                detail: `${quote.quoteId}/${item.category} evidence was not found in the final transcript`,
              }),
            );
        }
    void advanceSandboxWorkflow(n.negotiationId, startCall).catch((error) =>
      console.error(`[sandbox advance ${n.negotiationId}]`, error),
    );
  } catch (error) {
    console.warn(`[WEBHOOK_UNMATCHED] ${callId}:`, error);
  }
}

function jsonBody(body: unknown) {
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString("utf8"));
  return body;
}
export function buildServer(
  env: NodeJS.ProcessEnv = process.env,
  deps: { startCall?: CallStarter; conversationController?: ReturnType<typeof createConversationController> } = {},
) {
  const app = Fastify({ logger: false, bodyLimit: 1_000_000 });
  const conversationController = deps.conversationController ?? (env.OPENAI_API_KEY ? createConversationController(env) : null);
  purgeExpiredCallEvidence(new Date(), Number(env.CALL_DATA_RETENTION_DAYS ?? 30));
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body),
  );
  app.addHook("onSend", async (_req, reply, payload) => {
    reply.header("access-control-allow-origin", env.FRONTEND_ORIGIN ?? "*");
    reply.header("access-control-allow-headers", "content-type,x-tool-secret,x-admin-secret,authorization");
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
    return payload;
  });
  app.options("*", async (_req, reply) => reply.code(204).send());
  app.post("/v1/chat/completions", async (req, reply) => {
    const supplied = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (!env.CUSTOM_LLM_SHARED_SECRET || supplied !== env.CUSTOM_LLM_SHARED_SECRET)
      return reply.code(401).send({ error: "unauthorized" });
    if (!conversationController) return reply.code(503).send({ error: "conversation controller is not configured" });
    try {
      const request = parseCustomLlmRequest(jsonBody(req.body));
      if (!request.callId || !request.providerId) throw new Error("call correlation fields are required");
      const context = getCallContext(request.callId, request.providerId);
      if (context.call.attemptNumber !== request.attemptNumber) throw new Error("stale call attempt");
      if (context.call.deployment?.controllerVersion && context.call.deployment.controllerVersion !== request.controllerVersion)
        throw new Error("controller version mismatch");
      const result = await conversationController.processTurn(request);
      const id = `chatcmpl_${request.callId}_${Date.now()}`;
      const chunk = (delta: Record<string, unknown>, finish_reason: string | null = null) =>
        `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "negotiator-controller", choices: [{ index: 0, delta, finish_reason }] })}\n\n`;
      let stream: string;
      if (result.type === "speech") stream = chunk({ role: "assistant", content: result.text }) + chunk({}, "stop");
      else {
        const tool = result as Extract<ControllerResult, { type: "system_tool" }>;
        stream = chunk({ role: "assistant", tool_calls: [{ index: 0, id: `call_${randomUUID()}`, type: "function", function: { name: tool.name, arguments: JSON.stringify(tool.arguments) } }] }) + chunk({}, "tool_calls");
      }
      reply.header("content-type", "text/event-stream");
      reply.header("cache-control", "no-cache");
      return reply.send(`${stream}data: [DONE]\n\n`);
    } catch (error) {
      return reply.code(409).send({ error: error instanceof Error ? error.message : "controller failed" });
    }
  });
  app.post<{ Params: { toolName: string } }>(
    "/tools/:toolName",
    async (req, reply) => {
      const started = performance.now();
      if (req.headers["x-tool-secret"] !== env.TOOL_SHARED_SECRET)
        return reply.code(401).send({ error: "unauthorized" });
      if (
        !TOOL_NAMES.includes(req.params.toolName as (typeof TOOL_NAMES)[number])
      )
        return reply.code(404).send({ error: "unknown tool" });
      try {
        const raw = req.body as Buffer;
        const args = JSON.parse(raw.toString("utf8"));
        const result = dispatchTool(req.params.toolName, args);
        reply.header(
          "server-timing",
          `tool;dur=${(performance.now() - started).toFixed(1)}`,
        );
        return { ok: true, result };
      } catch (error) {
        req.log.error(error);
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "tool failed",
          fallback: "Let me double-check and follow up.",
        });
      }
    },
  );
  app.post("/webhooks/elevenlabs", async (req, reply) => {
    const raw = req.body as Buffer;
    const secret =
      env.ELEVENLABS_WEBHOOK_SECRET ?? env.TOOL_SHARED_SECRET ?? "";
    if (
      !verifyElevenLabsSignature(
        raw,
        req.headers["elevenlabs-signature"] as string | undefined,
        secret,
      )
    )
      return reply.code(401).send({ error: "invalid or stale signature" });
    try {
      await ingestWebhook(
        JSON.parse(raw.toString("utf8")),
        deps.startCall ?? startElevenLabsCall,
        conversationController,
      );
      return { status: "received" };
    } catch {
      return reply.code(400).send({ error: "invalid webhook" });
    }
  });
  app.setErrorHandler((error, _req, reply) => {
    const message = error instanceof Error ? error.message : "request failed";
    const status =
      error instanceof z.ZodError
        ? 422
        : message.includes("not found")
          ? 404
          : message.includes("required") || message.includes("before")
            ? 409
            : 400;
    return reply.code(status).send({
      error: error instanceof z.ZodError ? "validation failed" : message,
      issues: error instanceof z.ZodError ? error.issues : undefined,
    });
  });
  app.post("/api/negotiations", async (req) =>
    createNegotiation(jsonBody(req.body)),
  );
  app.get("/api/providers/eligible", async (req, reply) => {
    if (!env.ADMIN_SHARED_SECRET || req.headers["x-admin-secret"] !== env.ADMIN_SHARED_SECRET)
      return reply.code(401).send({ error: "unauthorized" });
    return eligibleRealProviders();
  });
  app.post("/api/providers", async (req, reply) => {
    if (!env.ADMIN_SHARED_SECRET || req.headers["x-admin-secret"] !== env.ADMIN_SHARED_SECRET)
      return reply.code(401).send({ error: "unauthorized" });
    return reply.code(201).send(registerOptedInProvider(jsonBody(req.body)));
  });
  app.post<{ Params: { id: string } }>("/api/providers/:id/revoke", async (req, reply) => {
    if (!env.ADMIN_SHARED_SECRET || req.headers["x-admin-secret"] !== env.ADMIN_SHARED_SECRET)
      return reply.code(401).send({ error: "unauthorized" });
    const body = z.object({ reason: z.string().min(1) }).parse(jsonBody(req.body));
    return revokeProviderConsent(req.params.id, body.reason);
  });
  app.post("/api/runs", async (req, reply) =>
    reply
      .code(202)
      .send(
        submitSandboxWorkflow(
          jsonBody(req.body),
          env,
          deps.startCall ?? startElevenLabsCall,
        ),
      ),
  );
  app.get<{ Params: { vin: string } }>("/api/vin/:vin", async (req) =>
    decodeVin(req.params.vin),
  );
  app.post("/api/negotiations/from-vin", async (req) =>
    createNegotiationFromVin(jsonBody(req.body)),
  );
  app.get<{ Params: { id: string } }>("/api/negotiations/:id", async (req) =>
    getNegotiation(req.params.id),
  );
  app.get("/api/negotiations/current", async (_req, reply) => {
    const n = currentNegotiation();
    return n ?? reply.code(404).send({ error: "no current negotiation" });
  });
  app.post<{ Params: { id: string } }>(
    "/api/negotiations/:id/documents",
    async (req) => {
      const b = z
        .object({ documentText: z.string(), label: z.string().optional() })
        .parse(jsonBody(req.body));
      return addDocument(req.params.id, b.documentText, b.label);
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/negotiations/:id/approvals",
    async (req) => {
      const b = z
        .object({
          action: z.enum([
            "CONFIRM_SPEC",
            "START_CALLS",
            "MAKE_COUNTEROFFER",
            "ACCEPT_OFFER",
            "SHARE_SENSITIVE_INFO",
            "CONFIRM_AGREEMENT",
          ]),
          details: z.string().min(1),
        })
        .parse(jsonBody(req.body));
      return recordApproval(req.params.id, b.action, b.details);
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/negotiations/:id/offers",
    async (req) => attachOffer(req.params.id, jsonBody(req.body)),
  );
  app.post<{ Params: { id: string } }>(
    "/api/negotiations/:id/recommendation",
    async (req) => recommend(req.params.id),
  );
  app.post<{ Params: { id: string } }>(
    "/api/negotiations/:id/resume",
    async (req) => {
      const n = getNegotiation(req.params.id);
      for (const call of n.calls.filter(
        (item) =>
          item.phase === "QUOTE_COLLECTION" &&
          item.status === "COMPLETE" &&
          !n.offers.some((offer) => offer.callId === item.callId),
      ))
        recoverCompletedQuote(call.callId, call.providerId);
      return advanceSandboxWorkflow(
        req.params.id,
        deps.startCall ?? startElevenLabsCall,
      );
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/negotiations/:id/retry-negotiation",
    async (req) =>
      retrySandboxNegotiation(
        req.params.id,
        deps.startCall ?? startElevenLabsCall,
      ),
  );
  app.post<{ Params: { id: string } }>(
    "/api/negotiations/:id/follow-ups",
    async (req) => {
      const b = z
        .object({
          idempotencyKey: z.string().min(1),
          dueAt: z.string().datetime(),
          note: z.string().min(1),
        })
        .parse(jsonBody(req.body));
      return addFollowUp(req.params.id, b);
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/negotiations/:id/close",
    async (req) => {
      const b = z
        .object({ outcome: z.enum(["accepted", "walked_away", "closed"]) })
        .parse(jsonBody(req.body));
      return closeNegotiation(req.params.id, b.outcome);
    },
  );
  app.get("/runs/current", async () => ({
    negotiation: currentNegotiation(),
    legacy: snapshot(),
  }));
  app.get("/health", async () => ({
    ok: true,
    service: "the-negotiator",
    storeLoaded: true,
  }));
  return app;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  buildServer()
    .listen({ port, host: "0.0.0.0" })
    .then(() => console.log(`Tool server listening on :${port}`))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
