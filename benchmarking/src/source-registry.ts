import type { EvidenceStrength, SignalKind } from "./contracts.js";

export interface SourceDefinition {
  id: string;
  publisher: string;
  url: string;
  strength: EvidenceStrength;
  parser: Array<{ kind: SignalKind; label: string; pattern: RegExp; typicalPattern?: RegExp; conditions: string[] }>;
}

// Deliberately short registry: free pages with explicit, attributable prices.
export const SOURCES: SourceDefinition[] = [
  {
    id: "aaa-windshield-costs",
    publisher: "AAA Automotive",
    url: "https://www.aaa.com/autorepair/articles/how-much-does-windshield-repair-or-replacement-cost",
    strength: "AUTHORITATIVE_DIRECTIONAL",
    parser: [
      { kind: "REPAIR", label: "Small chip repair", pattern: /Small chip repair:\s*\$([\d,]+)\s*[-–]\s*\$([\d,]+)/i, conditions: ["Small windshield chip", "National directional range"] },
      { kind: "REPAIR", label: "Crack repair", pattern: /Crack repair:\s*\$([\d,]+)\s*[-–]\s*\$([\d,]+)/i, conditions: ["Repairable crack", "National directional range"] },
      { kind: "REPLACEMENT", label: "Full windshield replacement", pattern: /Full replacement:\s*\$([\d,]+)\s*[-–]\s*\$([\d,]+)\+?/i, conditions: ["Vehicle and location materially affect price", "May exclude ADAS"] },
      { kind: "ADAS_CALIBRATION", label: "ADAS recalibration", pattern: /typical cost of recalibration is \$([\d,]+)/i, typicalPattern: /typical cost of recalibration is \$([\d,]+)/i, conditions: ["Camera-equipped vehicle", "Calibration type affects price"] },
      { kind: "LABOR", label: "Replacement labor", pattern: /ranging from \$([\d,]+)\s*(?:to|[-–])\s*\$([\d,]+) for windshield replacement/i, conditions: ["Varies by state"] }
    ]
  },
  {
    id: "aaa-adas-study",
    publisher: "AAA Newsroom",
    url: "https://newsroom.aaa.com/2023/12/fixing-advanced-vehicle-systems-makes-up-over-one-third-of-repair-costs-following-a-crash/",
    strength: "PRIMARY",
    parser: [
      { kind: "ADAS_CALIBRATION", label: "Average ADAS portion of windshield replacement", pattern: /ADAS components averaged [\d.]+% \(\$([\d,.]+)\) of the total repair cost/i, typicalPattern: /ADAS components averaged [\d.]+% \(\$([\d,.]+)\)/i, conditions: ["AAA study of three model-year-2023 vehicles", "ADAS component and calibration portion", "Not a full windshield quote"] }
    ]
  }
];
