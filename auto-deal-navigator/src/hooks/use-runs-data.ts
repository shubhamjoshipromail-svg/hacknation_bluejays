import { useCallback, useEffect, useState } from "react";
import type { JobSpec, PolicyDecision, Quote, RankingEntry } from "@/lib/mock-data";

export interface NegotiationData {
  negotiationId: string;
  state: string;
  intake: {
    objective: string;
    currentSituation: string;
    priorities: string[];
    constraints: string[];
    desiredOutcomeMinor: number | null;
    walkAwayMinor: number | null;
    vehicle: {
      year: number;
      make: string;
      model: string;
      vin: string | null;
      frontCamera: boolean;
    };
    postalCode: string;
    sources: Array<{ kind: string; label: string }>;
  };
  benchmark: {
    lowMinor: number;
    typicalMinor: number;
    highMinor: number;
    classification: string;
    sourceLabel: string;
    notes: string[];
  };
  strategy: {
    realisticTargetMinor: number;
    openingPositionMinor: number;
    walkAwayMinor: number;
    keyArguments: string[];
    questions: string[];
    requestConcessions: string[];
    risksToAvoid: string[];
  };
  approvals: Array<{ action: string }>;
  calls: Array<{
    callId: string;
    providerId: string;
    conversationId: string;
    status: "IN_PROGRESS" | "COMPLETE" | "FAILED";
    outcome: "QUOTED" | "CALLBACK_REQUIRED" | "DECLINED" | "DROPPED" | null;
    reason: string | null;
    transcript: Array<{
      turnId: string;
      speaker: "AGENT" | "SHOP";
      text: string;
      timeSeconds: number | null;
    }>;
  }>;
  offers: Array<{
    quoteId: string;
    providerId: string;
    stage: "INITIAL" | "NEGOTIATED";
    lineItems: Array<{
      category: string;
      rawLabel: string;
      amountMinor: number | null;
      status: "INCLUDED" | "EXCLUDED" | "NOT_APPLICABLE" | "UNKNOWN";
      provenanceIds: string[];
    }>;
    totals: { statedAllInMinor: number | null };
    redFlags: Array<{ detail: string }>;
  }>;
  redFlags: Array<{ code: string; severity: string; detail: string }>;
  recommendation: null | {
    action: string;
    offerId: string | null;
    summary: string;
    reasons: string[];
    suggestedCounterMinor: number | null;
  };
  followUps: Array<{ followUpId: string; dueAt: string; note: string; status: string }>;
  events: Array<{ eventId: string; type: string; detail: string; at: string }>;
}
export interface RunsData {
  jobSpec: JobSpec;
  quotes: Quote[];
  calls: Quote[];
  policyDecisions: PolicyDecision[];
  ranking: RankingEntry[];
  negotiation: NegotiationData | null;
  connection: "loading" | "live" | "empty" | "error";
  error: string | null;
  refresh: () => Promise<void>;
}

export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000";
const blankSpec: JobSpec = {
  hash: "No confirmed spec",
  status: "CONFIRMED",
  vehicle: { year: 0, make: "Not", model: "created", source: "VOICE" },
  vin: { masked: "Not provided", full: "", source: "DOCUMENT" },
  service: { type: "Windshield replacement", source: "VOICE" },
  payment: { type: "Cash-pay", source: "VOICE" },
  location: { zip: "-----", source: "VOICE" },
  adas: { confirmed: false, source: "VOICE", note: "Not confirmed" },
  schedule: { windows: [], source: "VOICE" },
};
function adapt(n: NegotiationData) {
  const masked = n.intake.vehicle.vin
    ? `${n.intake.vehicle.vin.slice(0, 3)}•••••••••${n.intake.vehicle.vin.slice(-5)}`
    : "Not provided";
  const jobSpec: JobSpec = {
    hash: n.negotiationId,
    status: "CONFIRMED",
    vehicle: {
      year: n.intake.vehicle.year,
      make: n.intake.vehicle.make,
      model: n.intake.vehicle.model,
      source: "VOICE",
    },
    vin: {
      masked,
      full: "",
      source: n.intake.sources.some((s) => s.kind === "DOCUMENT") ? "DOCUMENT" : "VOICE",
    },
    service: { type: "Windshield replacement", source: "VOICE" },
    payment: { type: "Cash-pay", source: "VOICE" },
    location: { zip: n.intake.postalCode, source: "VOICE" },
    adas: {
      confirmed: n.intake.vehicle.frontCamera,
      source: "VOICE",
      note: n.intake.vehicle.frontCamera ? "Front camera reported by user" : "Not reported",
    },
    schedule: { windows: [], source: "VOICE" },
  };
  const quotes: Quote[] = n.offers.map((o) => ({
    quoteId: o.quoteId,
    provider: o.providerId,
    location: "Phone quote",
    callStatus: "COMPLETE",
    jobSpecHash: n.negotiationId,
    lineItems: o.lineItems.map((item) => ({
      ...item,
      status: item.status === "NOT_APPLICABLE" ? "EXCLUDED" : item.status,
    })),
    transcriptTurns: [],
    events: n.events
      .filter((e) => e.detail.includes(o.providerId))
      .map((e) => ({
        id: e.eventId,
        kind: "LOG",
        text: e.detail,
        t: new Date(e.at).toLocaleTimeString(),
      })),
    redFlags: o.redFlags.map((f) => f.detail),
    originalOfferMinor: o.stage === "INITIAL" ? o.totals.statedAllInMinor : undefined,
    revisedOfferMinor: o.stage === "NEGOTIATED" ? o.totals.statedAllInMinor : undefined,
  }));
  const calls: Quote[] = n.calls.map((call) => ({
    quoteId: call.callId,
    provider: call.providerId.replaceAll("_", " "),
    location: call.outcome
      ? `${call.outcome.replaceAll("_", " ")}${call.reason ? ` · ${call.reason}` : ""}`
      : "Call in progress",
    callStatus: call.status === "IN_PROGRESS" ? "ON_CALL" : "COMPLETE",
    jobSpecHash: n.negotiationId,
    lineItems: [],
    transcriptTurns: call.transcript.map((turn) => ({
      turnId: turn.turnId,
      speaker: turn.speaker,
      text: turn.text,
      timestamp:
        turn.timeSeconds == null ? "--:--" : `00:${String(turn.timeSeconds).padStart(2, "0")}`,
    })),
    events: n.events
      .filter((event) => event.type === "CALL_RECORDED" && event.detail.includes(call.providerId))
      .map((event) => ({
        id: event.eventId,
        kind: "LOG",
        text: event.detail,
        t: new Date(event.at).toLocaleTimeString(),
      })),
    redFlags: [],
  }));
  const ranking: RankingEntry[] = quotes.map((q, i) => ({
    quoteId: q.quoteId,
    provider: q.provider,
    score: Math.max(0, 100 - i * 10),
    componentScores: { price: 0, completeness: 0, trust: 0, logistics: 0 },
    visiblePenalties: q.redFlags,
    explanation:
      n.recommendation?.offerId === q.quoteId ? n.recommendation.summary : "Awaiting comparison",
  }));
  return { jobSpec, quotes, calls, ranking };
}
export async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({ error: "Invalid server response" }));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}
export function useRunsData(): RunsData {
  const [negotiation, setNegotiation] = useState<NegotiationData | null>(null);
  const [connection, setConnection] = useState<RunsData["connection"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const n = await api("/api/negotiations/current");
      setNegotiation(n);
      setConnection("live");
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Backend unavailable";
      setNegotiation(null);
      setConnection(message.includes("no current") ? "empty" : "error");
      setError(message);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(poll);
  }, [refresh]);
  const mapped = negotiation
    ? adapt(negotiation)
    : { jobSpec: blankSpec, quotes: [], calls: [], ranking: [] };
  return { ...mapped, policyDecisions: [], negotiation, connection, error, refresh };
}
