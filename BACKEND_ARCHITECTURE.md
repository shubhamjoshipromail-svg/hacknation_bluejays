# Backend Outline - VIN to Negotiated Recommendation

## One canonical path

```text
VIN + user priorities
        |
        v
NHTSA vPIC decoder
        |
        v
Confirmed vehicle/job specification
        |
        +--> preliminary ESTIMATED benchmark
        |
        v
Explicit user approval to call
        |
        v
Three ElevenLabs/Twilio calls using the identical specification
        |
        v
Itemized offers + transcripts + provenance + red flags
        |
        +--> VERIFIED local benchmark after 2+ comparable quotes
        |
        v
Policy mints exact verified competitor facts
        |
        v
Negotiation callback uses only policy-released leverage
        |
        v
Deterministic recommendation + follow-up or terminal state
```

## 1. VIN decoding

The frontend submits one 17-character VIN to `POST /api/negotiations/from-vin`. `vin-service.ts` validates the VIN before making a request, calls the official NHTSA vPIC `DecodeVinValuesExtended` endpoint with a six-second timeout, validates the response, and normalizes:

- model year
- make
- model
- trim/series when NHTSA provides it
- body class and vehicle type
- available driver-assistance evidence

The raw VIN is durable backend input but is masked in frontend compatibility views. A successful identity decode is labeled `VERIFIED_VIN_DECODE`. ADAS evidence is treated more carefully: returned features can make ADAS likely, but missing vPIC fields never prove equipment is absent. Therefore every phone quote still has to explicitly establish whether windshield-camera calibration is required and included.

## 2. Specification construction

`negotiation-service.ts` combines the decoded vehicle with user inputs that VIN cannot answer: ZIP, cash-pay objective, priorities, constraints, target, walk-away point, and deadline. This produces one negotiation intake/specification and a concise call strategy. The same specification is reused for every provider, which protects quote comparability.

The user must record `CONFIRM_SPEC` before the state can become `strategy_ready`. The user must separately record `START_CALLS` before `scripts/run-call.ts` will initiate telephony.

## 3. Benchmark prices

Benchmark quality changes as evidence improves:

1. Before calls, the service provides a broad internal auto-glass reference range. It is explicitly labeled `ESTIMATED`, not verified.
2. Each provider call must capture glass/install, ADAS calibration, mobile service, moldings/sensor kit, disposal/environmental fees, supplies, tax, discounts, total, warranty, and scheduling terms.
3. A quote is benchmark-eligible only when its scope is comparable, its all-in total reconciles with its itemized values, and the required fields are known.
4. Once at least two distinct providers have eligible initial quotes for the same specification, the benchmark becomes `VERIFIED`. Its low, median, and high values are calculated deterministically from those local quotes.
5. Negotiated revisions do not change the initial-market benchmark; they are compared against it.

This means the system never describes an AI guess as a verified market price.

## 4. Red flags

`policy.ts` performs deterministic checks rather than asking a model to decide state:

- required calibration omitted or unknown
- stated total does not match itemized fees
- quote is at least 30% below the comparable median
- missing scope prevents comparability

The call prompt also forces explicit questions about hidden fees, warranties, price validity, scheduling, and what could change the price.

## 5. Verified leverage

Leverage has a strict evidence boundary:

1. A comparable, reconciled quote with transcript provenance is converted into a `VerifiedFact` by `mintCompetitorOfferFact`.
2. The fact contains the exact amount, specification hash, provider, supporting transcript IDs, expiration, and one exact sentence the buyer may say.
3. During a negotiation callback, the ElevenLabs agent calls `request_leverage`.
4. `policy.ts` rejects the request when there is no active eligible competing fact, when the fact belongs to the provider being called, or when the three-round concession ladder is exhausted.
5. On approval, the agent receives only the exact policy-approved sentence, for example: "I have a verified all-in quote of $630 for the same vehicle, including ADAS calibration."
6. A lower provider response is stored as a new immutable negotiated offer version. The original quote remains in history.

The language model chooses conversational phrasing around the request, but it cannot invent the number, provider evidence, or authorization.

## 6. Recommendation and lifecycle

The canonical negotiation aggregate stores intake, benchmark, strategy, approvals, calls, offers, red flags, recommendation, follow-ups, and append-only events. Recommendation rules compare the latest offer with:

- the user's target and walk-away point
- the verified or estimated benchmark
- offer comparability and reconciliation
- high-severity red flags
- previous offer versions and concessions

The result is one of `ACCEPT`, `COUNTER`, `CLARIFY`, `DELAY`, `ESCALATE`, or `WALK_AWAY`. This is advice only. Moving to `accepted` requires an explicit `ACCEPT_OFFER` approval.

## 7. File responsibilities

- `server.ts`: HTTP routes, validation boundary, CORS, tool auth, webhook verification, errors
- `vin-service.ts`: NHTSA adapter and normalized VIN result
- `negotiation-service.ts`: canonical lifecycle and aggregate mutations
- `domain.ts`: Zod request/state/output schemas
- `policy.ts`: deterministic totals, red flags, ranking, verified facts, leverage decisions
- `store.ts`: atomic JSON persistence and event history
- `tools.ts`: structured ElevenLabs call tools and transcript provenance
- `scripts/run-call.ts`: approved outbound-call orchestration and canonical offer attachment
- `prompts.ts`: disclosure, conversation checklist, friction handling, and honesty rules

No model output can directly create a state transition, approve a call, approve acceptance, or release an unverified competitor claim.
