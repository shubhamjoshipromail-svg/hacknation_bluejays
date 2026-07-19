import { createHash } from "node:crypto";
import type { DiscoveredProvider } from "./contracts.js";

type GeocodeResult = { lat: string; lon: string };
type OverpassElement = { type: "node" | "way" | "relation"; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

const headers = { "user-agent": "HacknationBenchmarking/1.0 (research prototype)" };

export async function discoverProviders(postalCode: string, fetchImpl: typeof fetch = fetch): Promise<DiscoveredProvider[]> {
  const geocode = new URL("https://nominatim.openstreetmap.org/search");
  geocode.searchParams.set("postalcode", postalCode);
  geocode.searchParams.set("country", "USA");
  geocode.searchParams.set("format", "jsonv2");
  geocode.searchParams.set("limit", "1");
  const geoResponse = await fetchImpl(geocode, { signal: AbortSignal.timeout(5000), headers });
  if (!geoResponse.ok) throw new Error(`postal geocode returned HTTP ${geoResponse.status}`);
  const [point] = await geoResponse.json() as GeocodeResult[];
  if (!point) return [];

  // OSM has no universal auto-glass tag, so search named vehicle-repair/service POIs.
  const namePattern = "auto.?glass|windshield|windscreen|safelite|glass doctor";
  const query = `[out:json][timeout:10];(nwr(around:30000,${Number(point.lat)},${Number(point.lon)})[name~"${namePattern}",i][shop~"car_repair|car_parts|car",i];nwr(around:30000,${Number(point.lat)},${Number(point.lon)})[name~"${namePattern}",i][craft~"car_repair",i];nwr(around:30000,${Number(point.lat)},${Number(point.lon)})[name~"${namePattern}",i][phone];);out center tags 20;`;
  const overpass = await fetchImpl("https://overpass-api.de/api/interpreter", { method: "POST", body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(15000), headers: { ...headers, "content-type": "application/x-www-form-urlencoded" } });
  if (!overpass.ok) throw new Error(`provider discovery returned HTTP ${overpass.status}`);
  const payload = await overpass.json() as { elements: OverpassElement[] };
  return payload.elements.flatMap(row => {
    const tags = row.tags ?? {}; const point = row.center ?? (row.lat != null && row.lon != null ? { lat: row.lat, lon: row.lon } : null);
    if (!point || !tags.name) return [];
    const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"], tags["addr:state"], tags["addr:postcode"]].filter(Boolean).join(" ") || null;
    return [{
      providerId: createHash("sha256").update(`${row.type}:${row.id}`).digest("hex").slice(0, 16),
      name: tags.name,
      phone: tags.phone ?? tags["contact:phone"] ?? null,
      website: tags.website ?? tags["contact:website"] ?? null,
      address, latitude: point.lat, longitude: point.lon,
      sourceUrl: `https://www.openstreetmap.org/${row.type}/${row.id}`,
      evidenceStrength: "DIRECTORY_DISCOVERY" as const
    }];
  });
}
