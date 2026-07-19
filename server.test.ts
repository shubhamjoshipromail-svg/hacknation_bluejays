import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer, verifyElevenLabsSignature } from "./server.js";
import {
  createSandboxNegotiation,
  getNegotiation,
  recordCall,
} from "./negotiation-service.js";
import { resetStore } from "./store.js";

const apps: ReturnType<typeof buildServer>[] = [];
const intake = () => ({
  vehicle: { year: 2021, make: "Volkswagen", model: "Tiguan", vin: null },
  damage: {
    service: "NOT_SURE" as const,
    type: "CRACK" as const,
    location: "CENTER" as const,
    drivable: true,
  },
  features: ["FRONT_CAMERA" as const],
  postalCode: "28202",
  insuranceInvolved: false,
  schedulePreference: null,
});
const provider = {
  providerId: "sandbox_provider",
  name: "Sandbox Auto Glass Provider",
  phoneNumber: "+15555550123",
  locationLabel: "Sandbox destination",
  source: "SANDBOX_CONFIG" as const,
  verified: true,
};
function callContext(callId = "call_test") {
  const n = createSandboxNegotiation(intake(), provider);
  recordCall(n.negotiationId, {
    callId,
    providerId: provider.providerId,
    conversationId: `conv_${callId}`,
    status: "IN_PROGRESS",
    outcome: null,
    reason: null,
  });
  return n;
}
beforeEach(() => resetStore());
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("voice server security", () => {
  it("rejects unauthenticated tools", async () => {
    const app = buildServer({ TOOL_SHARED_SECRET: "secret" });
    apps.push(app);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/tools/get_call_brief",
          payload: {},
        })
      ).statusCode,
    ).toBe(401);
  });
  it("serves authenticated call-bound tools", async () => {
    callContext();
    const app = buildServer({ TOOL_SHARED_SECRET: "secret" });
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/tools/get_call_brief",
      headers: { "x-tool-secret": "secret" },
      payload: { call_id: "call_test", provider_id: "sandbox_provider" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().result.sha256).toHaveLength(64);
  });
  it("recovers tool correlation from the system conversation id", async () => {
    callContext();
    const app = buildServer({ TOOL_SHARED_SECRET: "secret" });
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/tools/get_call_brief",
      headers: { "x-tool-secret": "secret" },
      payload: {
        call_id: "call_model_typo",
        provider_id: "sandbox_provider",
        conversation_id: "conv_call_test",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().result.text).toContain("Volkswagen Tiguan");
  });
  it("rejects stale webhook signatures", () => {
    const body = Buffer.from("{}"),
      timestamp = 100,
      sig = createHmac("sha256", "secret")
        .update(`${timestamp}.{}`)
        .digest("hex");
    expect(
      verifyElevenLabsSignature(
        body,
        `t=${timestamp},v0=${sig}`,
        "secret",
        2000,
      ),
    ).toBe(false);
  });
  it("accepts current valid webhook signatures", () => {
    const body = Buffer.from("{}"),
      timestamp = Math.floor(Date.now() / 1000),
      sig = createHmac("sha256", "secret")
        .update(`${timestamp}.{}`)
        .digest("hex");
    expect(
      verifyElevenLabsSignature(
        body,
        `t=${timestamp},v0=${sig}`,
        "secret",
        timestamp,
      ),
    ).toBe(true);
  });
});

describe("sandbox workflow API", () => {
  it("discovers the configured sandbox provider and starts its call automatically", async () => {
    let started = false;
    const startCall = async (negotiationId: string, providerId: string) => {
      started = true;
      return recordCall(negotiationId, {
        callId: "call_auto",
        providerId,
        conversationId: "conv_auto",
        status: "IN_PROGRESS",
        outcome: null,
        reason: null,
      });
    };
    const app = buildServer(
      { CALL_MODE: "SANDBOX", SANDBOX_PROVIDER_NUMBER: "+15555550123" },
      { startCall },
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: intake(),
    });
    expect(response.statusCode).toBe(202);
    await new Promise((resolve) => setImmediate(resolve));
    const current = getNegotiation(response.json().negotiationId);
    expect(current).toMatchObject({
      mode: "SANDBOX",
      state: "call_in_progress",
      benchmark: { classification: "ESTIMATED", sourceLabel: "Source-backed published auto-glass range" },
      providers: [{ providerId: "sandbox_provider", source: "SANDBOX_CONFIG" }],
      calls: [{ callId: "call_auto", status: "IN_PROGRESS" }],
    });
    expect(current.benchmarkContext?.evidence.length).toBeGreaterThan(0);
    expect(started).toBe(true);
  });
  it("refuses to run without an explicit sandbox provider number", async () => {
    const app = buildServer(
      { CALL_MODE: "SANDBOX" },
      {
        startCall: async () => {
          throw new Error("should not start");
        },
      },
    );
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: intake(),
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toContain("SANDBOX_PROVIDER_NUMBER");
  });
});

describe("public reads", () => {
  it("returns the current canonical negotiation", async () => {
    const n = callContext();
    const app = buildServer({});
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/negotiations/current",
      headers: { origin: "https://example.app" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.json().negotiationId).toBe(n.negotiationId);
  });
  it("adds wildcard CORS to every endpoint", async () => {
    const app = buildServer({});
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });
});

describe("tool validation", () => {
  it("keeps local synchronous tools well below the 800ms target", async () => {
    callContext();
    const app = buildServer({ TOOL_SHARED_SECRET: "secret" });
    apps.push(app);
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      const response = await app.inject({
        method: "POST",
        url: "/tools/get_call_brief",
        headers: { "x-tool-secret": "secret" },
        payload: { call_id: "call_test", provider_id: "sandbox_provider" },
      });
      samples.push(performance.now() - start);
      expect(response.statusCode).toBe(200);
    }
    samples.sort((a, b) => a - b);
    expect(samples[Math.floor(samples.length * 0.95)]).toBeLessThan(800);
  });
  it("rejects fractional cents from voice tools", async () => {
    callContext("c");
    const app = buildServer({ TOOL_SHARED_SECRET: "secret" });
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/tools/log_quote_total",
      headers: { "x-tool-secret": "secret" },
      payload: {
        call_id: "c",
        provider_id: "sandbox_provider",
        turn_id: "t",
        turn_text: "total",
        total_minor: 123.45,
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("integer cents");
  });
});

describe("post-call persistence", () => {
  it("attaches a signed transcript and dropped outcome to the canonical call", async () => {
    const callId = `test_${Date.now()}`,
      n = callContext(callId),
      secret = "webhook-secret",
      app = buildServer({ ELEVENLABS_WEBHOOK_SECRET: secret });
    apps.push(app);
    const payload = {
      type: "post_call_transcription",
      data: {
        conversation_id: `conv_${callId}`,
        status: "done",
        conversation_initiation_client_data: {
          dynamic_variables: {
            call_id: callId,
            provider_id: "sandbox_provider",
          },
        },
        transcript: [
          {
            id: "turn_1",
            role: "user",
            message: "We cannot quote that today.",
            time_in_call_secs: 4,
          },
        ],
      },
    };
    const raw = JSON.stringify(payload),
      timestamp = Math.floor(Date.now() / 1000),
      sig = createHmac("sha256", secret)
        .update(`${timestamp}.${raw}`)
        .digest("hex");
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/elevenlabs",
      headers: {
        "content-type": "application/json",
        "elevenlabs-signature": `t=${timestamp},v0=${sig}`,
      },
      payload: raw,
    });
    expect(response.statusCode).toBe(200);
    expect(getNegotiation(n.negotiationId).calls[0]).toMatchObject({
      status: "COMPLETE",
      outcome: "DROPPED",
      reason: "conversation ended without close_call",
      transcript: [{ speaker: "SHOP", text: "We cannot quote that today." }],
    });
  });
  it("persists tool-extracted quote evidence, validates the transcript, recommends, and starts negotiation", async () => {
    const callId = "call_quote",
      n = callContext(callId),
      secret = "webhook-secret";
    let negotiationStarted = false;
    const startCall = async (
      negotiationId: string,
      providerId: string,
      phase: "QUOTE_COLLECTION" | "NEGOTIATION" = "QUOTE_COLLECTION",
    ) => {
      negotiationStarted = phase === "NEGOTIATION";
      return recordCall(negotiationId, {
        callId: "call_negotiation",
        providerId,
        conversationId: "conv_negotiation",
        phase,
        status: "IN_PROGRESS",
        outcome: null,
        reason: null,
      });
    };
    const app = buildServer(
      { TOOL_SHARED_SECRET: "secret", ELEVENLABS_WEBHOOK_SECRET: secret },
      { startCall },
    );
    apps.push(app);
    const tool = async (name: string, payload: Record<string, unknown>) =>
      app.inject({
        method: "POST",
        url: `/tools/${name}`,
        headers: { "x-tool-secret": "secret" },
        payload: {
          call_id: callId,
          provider_id: "sandbox_provider",
          ...payload,
        },
      });
    const turns = [
      {
        id: "glass",
        text: "Glass and installation is six hundred dollars.",
        tool: "log_quote_item",
        payload: {
          category: "BASE_GLASS_AND_INSTALL",
          raw_label: "glass and installation",
          amount_minor: 60000,
          status: "INCLUDED",
        },
      },
      {
        id: "adas",
        text: "Calibration is included at one hundred fifty dollars.",
        tool: "log_quote_item",
        payload: {
          category: "ADAS_CALIBRATION",
          raw_label: "camera calibration",
          amount_minor: 15000,
          status: "INCLUDED",
        },
      },
      {
        id: "tax",
        text: "Tax is fifty dollars.",
        tool: "log_quote_item",
        payload: {
          category: "TAX",
          raw_label: "tax",
          amount_minor: 5000,
          status: "INCLUDED",
        },
      },
    ];
    for (const turn of turns)
      expect(
        (
          await tool(turn.tool, {
            turn_id: turn.id,
            turn_text: turn.text,
            ...turn.payload,
          })
        ).statusCode,
      ).toBe(200);
    expect(
      (
        await tool("log_quote_total", {
          turn_id: "total",
          turn_text: "The all-in total is eight hundred dollars.",
          total_minor: 80000,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await tool("close_call", {
          outcome: "QUOTED",
          reason: "Provider confirmed a complete all-in quote",
        })
      ).statusCode,
    ).toBe(200);
    const transcript = [
      ...turns.map((turn) => ({
        id: turn.id,
        role: "user",
        message: turn.text,
      })),
      {
        id: "total",
        role: "user",
        message: "The all-in total is eight hundred dollars.",
      },
    ];
    const payload = {
      type: "post_call_transcription",
      data: {
        conversation_id: `conv_${callId}`,
        status: "done",
        conversation_initiation_client_data: {
          dynamic_variables: {
            call_id: callId,
            provider_id: "sandbox_provider",
          },
        },
        transcript,
      },
    };
    const raw = JSON.stringify(payload),
      timestamp = Math.floor(Date.now() / 1000),
      sig = createHmac("sha256", secret)
        .update(`${timestamp}.${raw}`)
        .digest("hex");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/webhooks/elevenlabs",
          headers: {
            "content-type": "application/json",
            "elevenlabs-signature": `t=${timestamp},v0=${sig}`,
          },
          payload: raw,
        })
      ).statusCode,
    ).toBe(200);
    await new Promise((resolve) => setImmediate(resolve));
    const result = getNegotiation(n.negotiationId);
    expect(result.offers[0]).toMatchObject({
      providerId: "sandbox_provider",
      totals: { statedAllInMinor: 80000 },
      comparability: "COMPARABLE",
    });
    expect(result.calls[0]).toMatchObject({
      status: "COMPLETE",
      outcome: "QUOTED",
    });
    expect(result.recommendation?.action).toBe("COUNTER");
    expect(result.redFlags).toEqual([]);
    expect(negotiationStarted).toBe(true);
  });
});
