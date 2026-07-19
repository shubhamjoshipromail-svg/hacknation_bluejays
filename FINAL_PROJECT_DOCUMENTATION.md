# The Negotiator — Current Project Documentation

Documented July 19, 2026 against the sandbox workflow recovery branch.

## Product boundary

The current product is one reliable vertical slice:

`Submit intake -> configured sandbox provider -> automatic phone call -> saved transcript and quote -> frontend update -> deterministic recommendation`

Provider discovery is intentionally mocked. `CALL_MODE` must be `SANDBOX`, and the configured phone number is represented in the domain as a provider with source `SANDBOX_CONFIG`. It is never interpreted as the customer's number or a fallback contact. Google Places and other real discovery services are out of scope until this workflow is validated.

## User experience

The Lovable/TanStack frontend at `auto-deal-navigator/` keeps the existing visual system but reduces intake to the information required for a safe quote call: service need, damage, vehicle details, optional VIN/features, ZIP, insurance, and schedule. One action submits the intake. There are no manual provider selectors or fake approval steps in the sandbox path.

The frontend polls `GET /api/negotiations/current` and renders the canonical backend contract. Calls, transcript turns, evidence-backed quote fields, validation state, red flags, policy decisions, and recommendation all come from the active run. Empty states are shown when no quote exists; mock quote/ranking stories are not used as live results.

## Backend outline

1. `POST /api/runs` validates `SandboxIntake`.
2. `provider-search-service.ts` returns exactly one configured sandbox provider.
3. `workflow-service.ts` creates the canonical negotiation, records automatic sandbox approvals, and queues the quote call.
4. `elevenlabs-call-service.ts` starts the correct ElevenLabs agent directly and records both the ElevenLabs conversation ID and Twilio call SID.
5. ElevenLabs webhook tools call `POST /tools/:toolName`. Every mutation is resolved to the exact call, preferably by `call_id` and safely by the system conversation ID when necessary.
6. Tool results accumulate a call-specific quote draft and transcript-backed provenance.
7. The signed post-call webhook stores the final two-speaker transcript, closes the call, materializes and reconciles the quote, and creates the deterministic recommendation.
8. If the initial quote is comparable and the recommendation is `COUNTER`, the server starts a separate negotiation callback with the negotiation agent. Otherwise it stops at `CLARIFY`, `ACCEPT`, or `WALK_AWAY` as appropriate.

## VIN and specifications

VIN is optional in sandbox intake. When present it is retained in the canonical job specification; the agent prompt forbids volunteering it and allows saying it only if the provider explicitly requests it to identify the glass. Vehicle facts, damage, ADAS features, insurance mode, location, and schedule are passed to the call brief from the same persisted intake. This prevents frontend, prompt, and tool context from diverging.

The lower-level VIN route still supports an NHTSA vPIC decode for future VIN-first workflows. It is not required for the safe sandbox loop.

## Benchmarks and leverage

The sandbox benchmark is labeled estimated. No live market-price or provider-discovery claim is made. Provider quotes become verified evidence only when backed by transcript provenance and a reconciled itemization.

Negotiation leverage is deny-by-default. `request_leverage` can release only an exact statement created from an eligible verified quote, never a fabricated competitor claim and never the current provider's own quote. With only one sandbox provider, competitor price-match leverage will normally be denied; the negotiation agent may still ask truthfully whether there is price flexibility or whether a documented fee can be reduced. Binding acceptance, booking, and payment are outside the agent's authority.

## Persistence

`store.ts` writes the active canonical run atomically to `.data/current-run.json`. It persists intake, providers, call IDs and phases, partial/final transcript turns, evidence anchors, quote drafts and offers, verified facts, policy decisions, events, red flags, and recommendation. Restarting the backend reloads the run instead of replacing it with frontend mock data.

## Agent configuration

There are separate intake and negotiation agents. Provisioned webhook tool parameters use ElevenLabs dynamic variables for `call_id`, `provider_id`, and the system conversation ID. This prevents the language model from copying or altering identifiers. The intake prompt requires one fee category at a time, explicit tax status, no repeated completed questions, no VIN disclosure unless asked, a single read-back, and a structured `close_call` before goodbye.

## Security and safety

- Tool requests require `TOOL_SHARED_SECRET`.
- Final webhooks require a valid ElevenLabs HMAC signature.
- Phone numbers and provider discovery remain server-side configuration.
- Quote money uses integer cents and evidence provenance.
- Unknown amounts are never silently treated as zero.
- The system does not accept, book, pay, or make binding commitments.

## Local operation

Backend:

```bash
npm install
cp .env.example .env
npm run provision
npm run server
```

Frontend:

```bash
cd auto-deal-navigator
npm install
npm run dev
```

Open `http://localhost:8080`. A reachable HTTPS `PUBLIC_BASE_URL` is required for ElevenLabs tools and final webhooks.

## Validation status

Automated coverage includes automatic sandbox discovery/call dispatch, missing provider configuration, tool authentication and call binding, conversation-ID recovery, quote extraction and reconciliation, signed transcript ingestion, recommendation generation, and eligible negotiation kickoff. TypeScript, backend tests, frontend lint, and frontend production build are the release checks.

A controlled live sandbox call has demonstrated: automatic call creation, correct dynamic tool correlation, mid-call transcript/evidence persistence, structured line items and terms, final transcript replacement, quote materialization, reconciliation, and frontend-ready recommendation. A quote with unknown tax correctly remains non-comparable and produces `CLARIFY` rather than an unsafe automatic negotiation callback.
