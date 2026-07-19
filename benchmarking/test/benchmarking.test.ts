import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { createHandoff, liveQuoteBenchmark } from "../src/aggregate.js";
import { parseSource } from "../src/parser.js";
import { SOURCES } from "../src/source-registry.js";
import { evaluateVendorPrice, toBackendBenchmark, toBackendRecommendation } from "../src/decision.js";
import { parseVehiclePricing, vehiclePricingUrl } from "../src/vehicle-pricing.js";

describe("benchmark parsing", () => {
  it("extracts explicit AAA ranges with evidence", () => {
    const body = fs.readFileSync(new URL("../fixtures/aaa-costs.html", import.meta.url), "utf8");
    const signals = parseSource(SOURCES[0], body, "2026-07-19T00:00:00.000Z");
    expect(signals.find(s => s.kind === "REPLACEMENT")).toMatchObject({ lowMinor: 25000, highMinor: 150000 });
    expect(signals.find(s => s.kind === "ADAS_CALIBRATION")).toMatchObject({ typicalMinor: 36000 });
    expect(signals.every(s => s.evidence.excerpt.length > 0)).toBe(true);
  });
});

describe("price decision and backend compatibility", () => {
  const request = { postalCode: "28202", service: "REPLACEMENT" as const, frontCamera: false, vehicle: { year: 2014, make: "Dodge", model: "Grand Caravan SXT", vin: "2C4RDGCG8ER282317" } };
  const source = parseSource(SOURCES[0], fs.readFileSync(new URL("../fixtures/aaa-costs.html", import.meta.url), "utf8"));
  const vehicle = parseVehiclePricing(request, fs.readFileSync(new URL("../fixtures/grand-caravan.html", import.meta.url), "utf8"))!;
  const handoff = createHandoff(request, [], [...source, vehicle], [], "2026-07-19T00:00:00.000Z");

  it("rejects a quote above the vehicle-specific high plus 30%", () => {
    const decision = evaluateVendorPrice(250000, handoff);
    expect(decision).toMatchObject({ action: "REJECT_OVERPRICED", benchmarkHighMinor: 46887, maximumReasonableMinor: 60953 });
    expect(toBackendRecommendation(decision, "offer_1")).toMatchObject({ action: "WALK_AWAY", suggestedCounterMinor: null });
  });

  it("allows a quote at exactly 30% above the benchmark high", () => {
    expect(evaluateVendorPrice(60953, handoff).action).toBe("CONTINUE");
  });

  it("matches the current backend benchmark shape", () => {
    expect(toBackendBenchmark(handoff)).toMatchObject({ lowMinor: 32431, typicalMinor: 39659, highMinor: 46887, classification: "ESTIMATED" });
  });
});

describe("vehicle-specific pricing", () => {
  it("builds a model URL and excludes non-windshield estimates", () => {
    const request = { postalCode: "28202", service: "REPLACEMENT" as const, vehicle: { year: 2014, make: "Dodge", model: "Grand Caravan SXT" } };
    expect(vehiclePricingUrl(request)).toBe("https://autoglassestimator.com/vehicle/dodge-grand-caravan/");
    expect(parseVehiclePricing(request, fs.readFileSync(new URL("../fixtures/grand-caravan.html", import.meta.url), "utf8"))).toMatchObject({ lowMinor: 32431, typicalMinor: 39659, highMinor: 46887 });
  });
});

describe("dynamic local benchmark", () => {
  const base = { capturedAt: "2026-07-19T00:00:00.000Z", service: "REPLACEMENT" as const, lineItems: [], sameVehicleAndScope: true, totalReconciles: true, provenanceRef: "turn:1" };
  it("requires two providers and uses the median", () => {
    expect(liveQuoteBenchmark([{ ...base, observationId: "1", providerId: "a", statedAllInMinor: 78000 }])).toBeNull();
    expect(liveQuoteBenchmark([
      { ...base, observationId: "1", providerId: "a", statedAllInMinor: 78000 },
      { ...base, observationId: "2", providerId: "b", statedAllInMinor: 62700 },
      { ...base, observationId: "3", providerId: "c", statedAllInMinor: 63000 }
    ])).toEqual({ lowMinor: 62700, typicalMinor: 63000, highMinor: 78000, sampleSize: 3 });
  });

  it("keeps primary evidence separate from directional ranges", () => {
    const adas = parseSource(SOURCES[1], fs.readFileSync(new URL("../fixtures/aaa-adas.txt", import.meta.url), "utf8"))[0];
    const handoff = createHandoff({ postalCode: "28202", service: "REPLACEMENT", frontCamera: true }, [], [adas]);
    expect(handoff.strongEvidence).toHaveLength(1);
    expect(handoff.directionalEvidence).toHaveLength(0);
  });

  it("omits ADAS cost evidence when the vehicle is known not to have a front camera", () => {
    const adas = parseSource(SOURCES[1], fs.readFileSync(new URL("../fixtures/aaa-adas.txt", import.meta.url), "utf8"))[0];
    const handoff = createHandoff({ postalCode: "28202", service: "REPLACEMENT", frontCamera: false }, [], [adas]);
    expect(handoff.strongEvidence).toHaveLength(0);
  });
});
