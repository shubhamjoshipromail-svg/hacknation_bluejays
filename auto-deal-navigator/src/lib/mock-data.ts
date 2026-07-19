// Mock data for The Negotiator dashboard.
// All money is integer minor units (cents). Format with formatMoney().

export type LineItemStatus = "INCLUDED" | "EXCLUDED" | "UNKNOWN";
export type ProvenanceSource = "VOICE" | "DOCUMENT" | "NHTSA";
export type CallStatus = "QUEUED" | "ON_CALL" | "COMPLETE";

export interface Provenance {
  id: string;
  source: ProvenanceSource;
  turnId?: string;
  note?: string;
}

export interface LineItem {
  category: string;
  rawLabel: string;
  amountMinor: number | null;
  status: LineItemStatus;
  provenanceIds: string[];
}

export interface TranscriptTurn {
  turnId: string;
  speaker: "AGENT" | "SHOP";
  text: string;
  timestamp: string; // mm:ss
}

export interface Quote {
  quoteId: string;
  provider: string;
  location: string;
  callStatus: CallStatus;
  jobSpecHash: string;
  lineItems: LineItem[];
  transcriptTurns: TranscriptTurn[];
  events: Array<{ id: string; kind: "LOG" | "TRIGGER" | "TACTIC"; text: string; t: string }>;
  redFlags: string[];
  originalOfferMinor?: number;
  revisedOfferMinor?: number;
}

export interface PolicyDecision {
  id: string;
  decision: "ALLOW" | "DENY";
  allowedStatement?: string;
  denyReason?: string;
  timestamp: string;
}

export interface RankingEntry {
  quoteId: string;
  provider: string;
  score: number;
  componentScores: {
    price: number;
    completeness: number;
    trust: number;
    logistics: number;
  };
  visiblePenalties: string[];
  explanation: string;
}

export interface JobSpec {
  hash: string;
  status: "CONFIRMED";
  vehicle: { year: number; make: string; model: string; source: ProvenanceSource };
  vin: { masked: string; full: string; source: ProvenanceSource };
  service: { type: string; source: ProvenanceSource };
  payment: { type: string; source: ProvenanceSource };
  location: { zip: string; source: ProvenanceSource };
  adas: { confirmed: boolean; source: ProvenanceSource; note: string };
  schedule: { windows: string[]; source: ProvenanceSource };
}

export const JOB_SPEC: JobSpec = {
  hash: "0x9f2a…c81e",
  status: "CONFIRMED",
  vehicle: { year: 2021, make: "Volkswagen", model: "Tiguan", source: "VOICE" },
  vin: { masked: "3VV•••••••MM103995", full: "3VV2B7AX5MM103995", source: "DOCUMENT" },
  service: { type: "Windshield replacement", source: "VOICE" },
  payment: { type: "Cash-pay", source: "VOICE" },
  location: { zip: "28202", source: "VOICE" },
  adas: {
    confirmed: true,
    source: "NHTSA",
    note: "ADAS front camera: CONFIRMED (NHTSA)",
  },
  schedule: {
    windows: ["Thu Jul 23 · 8a–12p", "Fri Jul 24 · 1p–5p"],
    source: "VOICE",
  },
};

export const QUOTES: Quote[] = [
  {
    quoteId: "q_clearview",
    provider: "ClearView Auto Glass",
    location: "Charlotte, NC · 4.2mi",
    callStatus: "COMPLETE",
    jobSpecHash: JOB_SPEC.hash,
    originalOfferMinor: 84000,
    revisedOfferMinor: 76000,
    lineItems: [
      {
        category: "Glass & install",
        rawLabel: "OEM-equivalent glass + labor",
        amountMinor: 42000,
        status: "INCLUDED",
        provenanceIds: ["p1"],
      },
      {
        category: "ADAS calibration",
        rawLabel: "Static front camera calibration",
        amountMinor: 30000,
        status: "INCLUDED",
        provenanceIds: ["p2"],
      },
      {
        category: "Mobile service",
        rawLabel: "Mobile dispatch fee",
        amountMinor: 0,
        status: "INCLUDED",
        provenanceIds: ["p3"],
      },
      {
        category: "Moldings / clips",
        rawLabel: "Reveal moldings",
        amountMinor: 3500,
        status: "INCLUDED",
        provenanceIds: ["p4"],
      },
      {
        category: "Disposal",
        rawLabel: "Old glass disposal",
        amountMinor: 1500,
        status: "INCLUDED",
        provenanceIds: ["p5"],
      },
      {
        category: "Tax",
        rawLabel: "NC sales tax",
        amountMinor: 5250,
        status: "INCLUDED",
        provenanceIds: ["p6"],
      },
    ],
    events: [
      { id: "e1", kind: "LOG", text: "→ logged GLASS_INSTALL $420", t: "00:42" },
      { id: "e2", kind: "LOG", text: "→ logged ADAS_CALIBRATION $300", t: "01:15" },
      {
        id: "e3",
        kind: "TRIGGER",
        text: "[TRIGGER] verified_competitor_within_10_percent",
        t: "02:38",
      },
      { id: "e4", kind: "TACTIC", text: "[TACTIC] anchor_verified_quote", t: "02:41" },
      { id: "e5", kind: "LOG", text: "→ revised ALL_IN $760", t: "03:05" },
    ],
    redFlags: [],
    transcriptTurns: [
      {
        turnId: "t1",
        speaker: "AGENT",
        text: "Hi, I'm calling for a windshield replacement quote on a 2021 Volkswagen Tiguan, cash pay, ZIP 28202.",
        timestamp: "00:03",
      },
      {
        turnId: "t2",
        speaker: "SHOP",
        text: "Sure, that Tiguan has a front camera so we'll need calibration too. Glass and install is $420, calibration is $300.",
        timestamp: "00:18",
      },
      {
        turnId: "t3",
        speaker: "AGENT",
        text: "Got it — moldings, disposal, tax?",
        timestamp: "00:35",
      },
      {
        turnId: "t4",
        speaker: "SHOP",
        text: "Moldings $35, disposal $15, tax on top. All-in you're at $840.",
        timestamp: "00:48",
      },
      {
        turnId: "t5",
        speaker: "AGENT",
        text: "I have a verified quote from a mobile competitor at $585 all-in with calibration. Can you match?",
        timestamp: "02:38",
      },
      {
        turnId: "t6",
        speaker: "SHOP",
        text: "I can't hit $585 but I can come down to $760 all-in, that's the best I can do today.",
        timestamp: "03:01",
      },
    ],
  },
  {
    quoteId: "q_ricks",
    provider: "Rick's Discount Auto Glass",
    location: "Charlotte, NC · 6.8mi",
    callStatus: "COMPLETE",
    jobSpecHash: JOB_SPEC.hash,
    originalOfferMinor: 34500,
    lineItems: [
      {
        category: "Glass & install",
        rawLabel: "Aftermarket glass + labor",
        amountMinor: 29500,
        status: "INCLUDED",
        provenanceIds: ["p7"],
      },
      {
        category: "ADAS calibration",
        rawLabel: "not mentioned",
        amountMinor: null,
        status: "EXCLUDED",
        provenanceIds: ["p8"],
      },
      {
        category: "Mobile service",
        rawLabel: "In-shop only",
        amountMinor: null,
        status: "EXCLUDED",
        provenanceIds: [],
      },
      {
        category: "Moldings / clips",
        rawLabel: "unspecified",
        amountMinor: null,
        status: "UNKNOWN",
        provenanceIds: [],
      },
      {
        category: "Disposal",
        rawLabel: "unspecified",
        amountMinor: null,
        status: "UNKNOWN",
        provenanceIds: [],
      },
      {
        category: "Tax",
        rawLabel: "NC sales tax",
        amountMinor: 5000,
        status: "INCLUDED",
        provenanceIds: [],
      },
    ],
    events: [
      { id: "e1", kind: "LOG", text: "→ logged GLASS_INSTALL $295", t: "00:29" },
      { id: "e2", kind: "TRIGGER", text: "[TRIGGER] calibration_not_offered", t: "01:02" },
      { id: "e3", kind: "TACTIC", text: "[TACTIC] probe_missing_line_items", t: "01:08" },
      { id: "e4", kind: "LOG", text: "→ flagged RED calibration_omitted", t: "01:44" },
    ],
    redFlags: ["Calibration omitted", "30% below market"],
    transcriptTurns: [
      {
        turnId: "t1",
        speaker: "AGENT",
        text: "Windshield replacement, 2021 Tiguan — quote?",
        timestamp: "00:04",
      },
      {
        turnId: "t2",
        speaker: "SHOP",
        text: "Yeah we can do that for $295 out the door.",
        timestamp: "00:29",
      },
      {
        turnId: "t3",
        speaker: "AGENT",
        text: "Does that include ADAS front camera calibration?",
        timestamp: "01:02",
      },
      {
        turnId: "t4",
        speaker: "SHOP",
        text: "Nah we don't do that here, you'd take it to the dealer after.",
        timestamp: "01:11",
      },
    ],
  },
  {
    quoteId: "q_glassgo",
    provider: "GlassGo Mobile",
    location: "Mobile · comes to you",
    callStatus: "ON_CALL",
    jobSpecHash: JOB_SPEC.hash,
    originalOfferMinor: 58500,
    lineItems: [
      {
        category: "Glass & install",
        rawLabel: "OEM glass + mobile install",
        amountMinor: 39500,
        status: "INCLUDED",
        provenanceIds: [],
      },
      {
        category: "ADAS calibration",
        rawLabel: "Dynamic calibration on-site",
        amountMinor: 15000,
        status: "INCLUDED",
        provenanceIds: [],
      },
      {
        category: "Mobile service",
        rawLabel: "Included",
        amountMinor: 0,
        status: "INCLUDED",
        provenanceIds: [],
      },
      {
        category: "Moldings / clips",
        rawLabel: "Included",
        amountMinor: 0,
        status: "INCLUDED",
        provenanceIds: [],
      },
      {
        category: "Disposal",
        rawLabel: "Included",
        amountMinor: 0,
        status: "INCLUDED",
        provenanceIds: [],
      },
      {
        category: "Tax",
        rawLabel: "NC sales tax",
        amountMinor: 4000,
        status: "INCLUDED",
        provenanceIds: [],
      },
    ],
    events: [
      { id: "e1", kind: "LOG", text: "→ logged GLASS_INSTALL $395", t: "00:22" },
      { id: "e2", kind: "LOG", text: "→ logged ADAS_CALIBRATION $150 (dynamic)", t: "00:51" },
      { id: "e3", kind: "TRIGGER", text: "[TRIGGER] all_in_under_market_median", t: "01:20" },
      { id: "e4", kind: "TACTIC", text: "[TACTIC] confirm_all_in_no_surprises", t: "01:25" },
    ],
    redFlags: [],
    transcriptTurns: [
      {
        turnId: "t1",
        speaker: "AGENT",
        text: "Mobile windshield on a 2021 Tiguan with front camera calibration, ZIP 28202.",
        timestamp: "00:05",
      },
      {
        turnId: "t2",
        speaker: "SHOP",
        text: "OEM glass, dynamic calibration, mobile — $585 all-in with tax.",
        timestamp: "01:12",
      },
      {
        turnId: "t3",
        speaker: "AGENT",
        text: "That includes moldings, disposal, no surprise fees?",
        timestamp: "01:20",
      },
      {
        turnId: "t4",
        speaker: "SHOP",
        text: "Correct, all-in. We can do Thursday morning.",
        timestamp: "01:31",
      },
    ],
  },
];

export const POLICY_DECISIONS: PolicyDecision[] = [
  {
    id: "pd1",
    decision: "ALLOW",
    allowedStatement:
      "State verified competitor all-in of $585 (GlassGo Mobile) and request match.",
    timestamp: "02:37",
  },
  {
    id: "pd2",
    decision: "ALLOW",
    allowedStatement: "Confirm calibration line item and anchor to verified price.",
    timestamp: "02:41",
  },
  {
    id: "pd3",
    decision: "DENY",
    denyReason: "no verified fact — request refused",
    timestamp: "02:55",
  },
  {
    id: "pd4",
    decision: "ALLOW",
    allowedStatement: "Accept revised offer at $760 all-in; log VERIFIED_SAVINGS $80.",
    timestamp: "03:05",
  },
];

export const RANKING: RankingEntry[] = [
  {
    quoteId: "q_glassgo",
    provider: "GlassGo Mobile",
    score: 92,
    componentScores: { price: 96, completeness: 94, trust: 88, logistics: 92 },
    visiblePenalties: [],
    explanation:
      "Lowest all-in of the three, includes ADAS calibration and mobile service. Fully itemized with no missing categories.",
  },
  {
    quoteId: "q_clearview",
    provider: "ClearView Auto Glass",
    score: 78,
    componentScores: { price: 68, completeness: 92, trust: 84, logistics: 68 },
    visiblePenalties: ["+$175 over verified market", "Shop-only (no mobile)"],
    explanation:
      "Fully itemized and matched to spec, but $175 above verified market and requires drop-off.",
  },
  {
    quoteId: "q_ricks",
    provider: "Rick's Discount Auto Glass",
    score: 34,
    componentScores: { price: 88, completeness: 22, trust: 30, logistics: 40 },
    visiblePenalties: [
      "Calibration omitted (safety)",
      "30% below market — likely undisclosed exclusions",
      "Aftermarket glass",
    ],
    explanation:
      "Lowest headline number, but calibration is required for this vehicle and was not included. Real all-in likely higher after dealer calibration.",
  },
];

export function formatMoney(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "—";
  const dollars = minor / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
  }).format(dollars);
}

export function totalMinor(items: LineItem[]): number | null {
  // If ANY UNKNOWN, total is not certain — return sum of known but mark caller
  return items.reduce<number>((s, li) => s + (li.amountMinor ?? 0), 0);
}

export function hasUnknown(items: LineItem[]): boolean {
  return items.some((li) => li.status === "UNKNOWN");
}
