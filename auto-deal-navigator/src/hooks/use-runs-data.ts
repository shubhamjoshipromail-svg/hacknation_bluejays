import { useCallback, useEffect, useState } from "react";
import type { JobSpec, PolicyDecision, Quote, RankingEntry } from "@/lib/mock-data";
import type { RunView } from "../../../shared/contracts";

export type NegotiationData = RunView;
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
const CATEGORY_LABELS: Record<string, string> = {
  BASE_GLASS_AND_INSTALL: "Glass & install",
  ADAS_CALIBRATION: "ADAS calibration",
  MOBILE_SERVICE: "Mobile service",
  MOLDINGS_CLIPS_SENSOR_KIT: "Moldings / clips",
  DISPOSAL_ENVIRONMENTAL: "Disposal",
  SHOP_SUPPLIES: "Shop supplies",
  TAX: "Tax",
  DISCOUNT: "Discount",
  OTHER: "Other",
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
  const quotes: Quote[] = [...n.offers]
    .sort((a, b) => Number(b.stage === "NEGOTIATED") - Number(a.stage === "NEGOTIATED"))
    .map((o) => ({
      quoteId: o.quoteId,
      providerId: o.providerId,
      provider: n.providers.find((p) => p.providerId === o.providerId)?.name ?? o.providerId,
      location: "Phone quote",
      callStatus: "COMPLETE",
      jobSpecHash: n.negotiationId,
      lineItems: o.lineItems.map((item) => ({
        ...item,
        category: CATEGORY_LABELS[item.category] ?? item.category,
        status: item.status === "NOT_APPLICABLE" ? "EXCLUDED" : item.status,
      })),
      transcriptTurns: (n.calls.find((call) => call.callId === o.callId)?.transcript ?? []).map(
        (turn) => ({
          turnId: turn.turnId,
          speaker: turn.speaker,
          text: turn.text,
          timestamp:
            turn.timeSeconds == null ? "--:--" : `00:${String(turn.timeSeconds).padStart(2, "0")}`,
        }),
      ),
      events: n.events
        .filter((e) => e.detail.includes(o.providerId))
        .map((e) => ({
          id: e.eventId,
          kind: "LOG",
          text: e.detail,
          t: new Date(e.at).toLocaleTimeString(),
        })),
      redFlags: [...new Set(o.redFlags.map((f) => f.detail))],
      originalOfferMinor: o.stage === "INITIAL" ? o.totals.statedAllInMinor : undefined,
      revisedOfferMinor: o.stage === "NEGOTIATED" ? o.totals.statedAllInMinor : undefined,
      canonicalTotalMinor: o.totals.statedAllInMinor,
      computedKnownMinor: o.totals.computedKnownMinor,
      comparability: o.comparability,
      reconciliation: o.totals.reconciliation,
    }));
  const calls: Quote[] = n.calls.map((call) => ({
    quoteId: call.callId,
    provider:
      n.providers.find((provider) => provider.providerId === call.providerId)?.name ??
      call.providerId.replaceAll("_", " "),
    location: call.outcome
      ? `${call.outcome.replaceAll("_", " ")}${call.reason ? ` · ${call.reason}` : ""}`
      : "Call in progress",
    callStatus:
      call.status === "QUEUED" ? "QUEUED" : call.status === "IN_PROGRESS" ? "ON_CALL" : "COMPLETE",
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
  const ranking: RankingEntry[] = n.ranking.flatMap((entry) => {
    const q = quotes.find((quote) => quote.quoteId === entry.quoteId);
    if (!entry.eligible || entry.score == null || !entry.componentScores || !q) return [];
    return [
      {
        quoteId: q.quoteId,
        provider: q.provider,
        score: Math.round(entry.score),
        componentScores: {
          price: Math.round((entry.componentScores.price / 45) * 100),
          completeness: Math.round((entry.componentScores.completeness / 20) * 100),
          trust: Math.round((entry.componentScores.scopeQuality / 15) * 100),
          logistics: Math.round((entry.componentScores.schedule / 10) * 100),
        },
        visiblePenalties: entry.visiblePenalties,
        explanation:
          n.recommendation?.reasons.join(" ") ?? "Comparable offer ranked by backend policy",
      },
    ];
  });
  const policyDecisions: PolicyDecision[] = n.policyDecisions.map((decision) => ({
    id: decision.decisionId,
    decision: decision.decision,
    allowedStatement: decision.allowedStatement ?? undefined,
    denyReason: decision.denyReason ?? undefined,
    timestamp: new Date(decision.at).toLocaleTimeString(),
  }));
  return { jobSpec, quotes, calls, ranking, policyDecisions };
}
export async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(init?.headers ?? {}),
    },
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
    : { jobSpec: blankSpec, quotes: [], calls: [], ranking: [], policyDecisions: [] };
  return { ...mapped, negotiation, connection, error, refresh };
}
