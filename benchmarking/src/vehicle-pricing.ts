import { createHash } from "node:crypto";
import type { BenchmarkRequest, BenchmarkSignal } from "./contracts.js";

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const cents = (value: string) => Math.round(Number(value.replaceAll(",", "")) * 100);
const plainText = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");

export function vehiclePricingUrl(request: BenchmarkRequest) {
  if (!request.vehicle) throw new Error("vehicle is required for vehicle-specific pricing");
  return `https://autoglassestimator.com/vehicle/${slug(request.vehicle.make)}-${slug(request.vehicle.model.replace(/\s+(SXT|SE|R\/T|CREW).*$/i, ""))}/`;
}

export function parseVehiclePricing(request: BenchmarkRequest, html: string, retrievedAt = new Date().toISOString()): BenchmarkSignal | null {
  if (!request.vehicle) return null;
  const text = plainText(html);
  const { year, make, model } = request.vehicle;
  const averageSection = text.match(new RegExp(`${year}\\s*\\$([\\d,]+\\.\\d{2})`, "i"));
  const vehicleName = `${year} ${make} ${model.replace(/\s+(SXT|SE|R\/T|CREW).*$/i, "")}`.trim();
  const recentPattern = new RegExp(`${vehicleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^$]{0,120}Windshield\\s*\\$([\\d,]+\\.\\d{2})`, "gi");
  const recent = [...text.matchAll(recentPattern)].map(match => cents(match[1]));
  const values = [...(averageSection ? [cents(averageSection[1])] : []), ...recent];
  if (values.length < 2) return null;
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const typical = values.length % 2 ? values[middle] : Math.round((values[middle - 1] + values[middle]) / 2);
  const url = vehiclePricingUrl(request);
  const excerpt = `${vehicleName}: model-year average and ${recent.length} recent matching windshield estimate(s), ${values.map(v => `$${(v / 100).toFixed(2)}`).join(", ")}`;
  return {
    signalId: createHash("sha256").update(`${url}:${year}:${values.join(",")}`).digest("hex").slice(0, 16),
    kind: "REPLACEMENT", label: `${vehicleName} windshield replacement`,
    lowMinor: values[0], typicalMinor: typical, highMinor: values.at(-1)!, currency: "USD",
    geography: "US_NATIONAL", conditions: [`Vehicle match: ${year} ${make} ${model}`, "Includes model-year average plus recent same-year windshield estimates", "Location and glass options can change price"],
    evidence: { sourceId: "auto-glass-estimator-vehicle", publisher: "Auto Glass Estimator", url, retrievedAt, publishedOrUpdatedAt: null, strength: "DIRECTIONAL", excerpt }
  };
}
