import type { BenchmarkHandoff, BenchmarkRequest, CallQuoteObservation, DiscoveredProvider } from "./contracts.js";
import { assertRequest } from "./contracts.js";
import { createHandoff } from "./aggregate.js";
import { fetchText } from "./fetcher.js";
import { parseSource } from "./parser.js";
import { discoverProviders } from "./providers.js";
import { SOURCES } from "./source-registry.js";
import { parseVehiclePricing, vehiclePricingUrl } from "./vehicle-pricing.js";

export interface PipelineOptions { offlineBodies?: Record<string, string>; skipProviders?: boolean; skipVehiclePricing?: boolean; observations?: CallQuoteObservation[] }

export async function runBenchmarkPipeline(input: unknown, options: PipelineOptions = {}): Promise<BenchmarkHandoff> {
  assertRequest(input);
  const settled = await Promise.allSettled(SOURCES.map(async source => parseSource(source, options.offlineBodies?.[source.id] ?? await fetchText(source.url))));
  const signals = settled.flatMap(result => result.status === "fulfilled" ? result.value : []);
  if (input.vehicle && input.service !== "REPAIR" && !options.skipVehiclePricing) {
    try {
      const body = options.offlineBodies?.["vehicle-pricing"] ?? await fetchText(vehiclePricingUrl(input));
      const vehicleSignal = parseVehiclePricing(input, body);
      if (vehicleSignal) signals.push(vehicleSignal);
    } catch { /* Vehicle source is best-effort; generic evidence remains available. */ }
  }
  let providers: DiscoveredProvider[] = [];
  if (!options.skipProviders) {
    try { providers = await discoverProviders(input.postalCode); } catch { providers = []; }
  }
  return createHandoff(input, providers, signals, options.observations);
}
