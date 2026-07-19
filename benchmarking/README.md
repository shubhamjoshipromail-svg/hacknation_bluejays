# Auto-glass benchmarking vertical

Source-backed discovery and benchmark pipeline with a narrow adapter into the current application. The pipeline remains independently runnable; the sandbox workflow imports only its handoff, aggregation, and decision contracts.

## What it does

1. Geocodes the requested ZIP once with OpenStreetMap Nominatim, then runs one bounded Overpass query for nearby named auto-glass businesses.
2. Fetches a small registry of free pages with explicit price evidence.
3. Extracts normalized USD ranges while retaining publisher, URL, retrieval time, and the exact supporting excerpt.
4. Separates primary study evidence from authoritative but directional consumer ranges.
5. Produces a versioned `BenchmarkHandoff` JSON document.
6. Optionally incorporates `CallQuoteObservation` objects during calls. A verified local range appears only after two different providers provide reconciled, same-vehicle-and-scope quotes.

## Run independently

From this directory:

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm benchmark examples/request.json --offline
pnpm benchmark examples/request.json
```

Offline mode is deterministic and tests parsing against source-derived fixtures. Live mode is best-effort: individual source or directory failures produce partial output rather than blocking the calling agent.

## Evidence policy

- `PRIMARY`: a study or first-party measurement with stated methodology, currently AAA's ADAS study and its official HTML summary.
- `AUTHORITATIVE_DIRECTIONAL`: explicit published ranges from a recognized automotive organization; useful for call preparation, never represented as a local quote.
- `DIRECTIONAL`: secondary estimates. The schema supports these, but none are enabled in the initial registry.
- Live provider quotes become a local benchmark only when they are same-scope, itemized/reconciled, and sourced to call provenance.

NHTSA vPIC remains the preferred future vehicle identity/ADAS-context adapter, but this module intentionally does not duplicate or call the application's existing VIN service. The future backend should provide already-decoded vehicle context in `BenchmarkRequest`.

## Application integration boundary

Call one function:

```ts
runBenchmarkPipeline(request, { observations }) => Promise<BenchmarkHandoff>
```

`benchmark-service.ts` calls this function in deterministic offline mode with `skipProviders` and `skipVehiclePricing`. This means the current sandbox workflow uses the bundled source-derived evidence and call guidance without Google Places, OpenStreetMap discovery, live provider lookup, or network-dependent pricing. The handoff is stored as `benchmarkContext`, and the existing backend `Benchmark` is updated through `toBackendBenchmark()` before the phone call starts.

After calls, `quoteObservation()` adapts reconciled initial offers back into this vertical's `CallQuoteObservation` contract. `liveQuoteBenchmark()` promotes the range to `VERIFIED` only after two different providers have same-scope, reconciled quotes. Published evidence is always directional and is never released as negotiation leverage.

`evaluateVendorPrice(quoteMinor, handoff)` applies one decision rule: a quote more than 30% above the benchmark high is `REJECT_OVERPRICED`. `toBackendRecommendation()` maps that result to the current backend's existing `WALK_AWAY` action, so integration does not require a new action enum.

## Deliberate exclusions

- Google Places and Yelp: credentials, billing setup, and/or restricted data reuse.
- IBISWorld and Mordor: paywalled market sizing, not transaction-price evidence.
- NAGS: proprietary glass pricing.
- Search-result scraping and quote-form automation: brittle and often prohibited.
- Public Nominatim/Overpass at scale: this prototype makes one user-triggered request to each and identifies itself. Production should use hosted or self-hosted OSM infrastructure, caching, and preserve OpenStreetMap attribution.
