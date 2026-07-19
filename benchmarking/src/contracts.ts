export type EvidenceStrength = "PRIMARY" | "AUTHORITATIVE_DIRECTIONAL" | "DIRECTIONAL";
export type SignalKind = "REPAIR" | "REPLACEMENT" | "ADAS_CALIBRATION" | "LABOR" | "FEE";

export interface BenchmarkRequest {
  postalCode: string;
  vehicle?: { year: number; make: string; model: string; vin?: string | null };
  service: "REPAIR" | "REPLACEMENT" | "NOT_SURE";
  frontCamera?: boolean;
}

export interface SourceEvidence {
  sourceId: string;
  publisher: string;
  url: string;
  retrievedAt: string;
  publishedOrUpdatedAt: string | null;
  strength: EvidenceStrength;
  excerpt: string;
}

export interface BenchmarkSignal {
  signalId: string;
  kind: SignalKind;
  label: string;
  lowMinor: number;
  typicalMinor: number | null;
  highMinor: number;
  currency: "USD";
  geography: "US_NATIONAL" | "LOCAL_QUOTE";
  conditions: string[];
  evidence: SourceEvidence;
}

export interface DiscoveredProvider {
  providerId: string;
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  sourceUrl: string;
  evidenceStrength: "DIRECTORY_DISCOVERY";
}

export interface CallQuoteObservation {
  observationId: string;
  providerId: string;
  capturedAt: string;
  service: "REPAIR" | "REPLACEMENT";
  statedAllInMinor: number | null;
  lineItems: Array<{ category: string; amountMinor: number | null; status: "INCLUDED" | "EXCLUDED" | "UNKNOWN" }>;
  sameVehicleAndScope: boolean;
  totalReconciles: boolean;
  provenanceRef: string;
}

export interface BenchmarkHandoff {
  schemaVersion: "1.0";
  generatedAt: string;
  request: BenchmarkRequest;
  providers: DiscoveredProvider[];
  strongEvidence: BenchmarkSignal[];
  directionalEvidence: BenchmarkSignal[];
  liveQuoteBenchmark: { lowMinor: number; typicalMinor: number; highMinor: number; sampleSize: number } | null;
  callGuidance: { expectedRangeMinor: [number, number] | null; requiredQuestions: string[]; warnings: string[] };
  updateInterface: { accepts: "CallQuoteObservation"; rule: string };
}

export interface PriceDecision {
  action: "CONTINUE" | "REJECT_OVERPRICED";
  quoteMinor: number;
  benchmarkHighMinor: number;
  maximumReasonableMinor: number;
  tolerancePercent: 30;
  percentAboveBenchmarkHigh: number;
  confidence: number;
  reason: string;
}

// Structural match for the current backend's existing Benchmark contract.
export interface BackendBenchmark {
  lowMinor: number;
  typicalMinor: number;
  highMinor: number;
  classification: "VERIFIED" | "ESTIMATED";
  sourceLabel: string;
  notes: string[];
  generatedAt: string;
}

export function assertRequest(value: unknown): asserts value is BenchmarkRequest {
  const v = value as Partial<BenchmarkRequest>;
  if (!v || !/^\d{5}$/.test(v.postalCode ?? "")) throw new Error("postalCode must be five digits");
  if (!["REPAIR", "REPLACEMENT", "NOT_SURE"].includes(v.service ?? "")) throw new Error("service is invalid");
}
