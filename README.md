# The Negotiator

The Negotiator is a phone-based auto-glass quote and negotiation assistant. The current product path is an intentionally safe sandbox: a user submits a minimal intake, the backend returns one configured sandbox provider, starts an ElevenLabs outbound call automatically, stores the transcript and itemized quote, and updates the frontend from the same canonical run.

The canonical product path is deliberately small:

`submit intake -> mock provider discovery -> automatic quote call -> transcript + quote -> recommendation`

The AI never accepts, rejects, counters, shares sensitive information, books, pays, or confirms an agreement without an explicit user approval.

## Architecture

- One Fastify API: `server.ts`
- One workflow/state service: `negotiation-service.ts`
- One atomic JSON store: `store.ts` -> `.data/current-run.json`
- Deterministic policy and comparison rules: `policy.ts`
- One direct ElevenLabs/Twilio call adapter: `elevenlabs-call-service.ts`
- One sandbox discovery adapter: `provider-search-service.ts`
- One automatic orchestrator: `workflow-service.ts`
- One React/TanStack frontend: `auto-deal-navigator/`

The legacy text loop and three YAML personas remain as a labeled golden-path evaluation fixture. They are not the source of product state.

## Local setup

Requires Node.js 20+.

```bash
npm install
cp .env.example .env
npm run server
```

In a second terminal:

```bash
cd auto-deal-navigator
npm install
npm run dev
```

The frontend uses `http://localhost:3000` by default. Set `VITE_API_URL` when the backend is elsewhere.

## Environment variables

Voice calls require:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_PHONE_NUMBER_ID`
- `TOOL_SHARED_SECRET`
- `PUBLIC_BASE_URL`
- `ELEVENLABS_WEBHOOK_SECRET`
- `CALL_MODE=SANDBOX`
- `SANDBOX_PROVIDER_NAME`
- `SANDBOX_PROVIDER_NUMBER`

For compatibility, an existing `PERSONA_TO_NUMBER` is used only when `SANDBOX_PROVIDER_NUMBER` is absent. In either case it is treated explicitly as the sandbox provider, never as a customer fallback. Google Places and real provider discovery are not used.

`TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are used while configuring telephony. `OPENAI_API_KEY` and `OPENAI_MODEL` are optional and only used by the legacy report-prose fixture.

## Automatic sandbox API

- `POST /api/runs` - accepts minimal vehicle/service intake, discovers the configured sandbox provider, persists a run, and starts the quote call asynchronously
- `GET /api/negotiations/current` - shared frontend/backend run contract
- `POST /tools/:toolName` - authenticated ElevenLabs tools that write call-specific evidence, quote fields, terms, and outcomes
- `POST /webhooks/elevenlabs` - authenticated final transcript ingestion, quote reconciliation, recommendation, and eligible negotiation kickoff

The VIN is optional in sandbox intake. If supplied, it is passed as a private specification field and the voice agent says it only when the provider explicitly asks.

The lower-level endpoints below remain for validation, tests, and future provider discovery:

- `GET /api/vin/:vin` - official NHTSA vPIC decode with normalized ADAS evidence
- `POST /api/negotiations/from-vin` - canonical VIN-first intake; year/make/model are not manually entered
- `POST /api/negotiations` - lower-level validated intake used by tests and adapters
- `POST /api/negotiations/:id/documents` - add pasted text from an existing quote/bill into the same spec
- `POST /api/negotiations/:id/approvals` - explicit approval checkpoint
- `POST /api/negotiations/:id/offers` - transcript-backed structured offer
- `POST /api/negotiations/:id/recommendation` - deterministic next action
- `POST /api/negotiations/:id/follow-ups` - idempotent recall task
- `POST /api/negotiations/:id/close` - terminal state; acceptance requires `ACCEPT_OFFER`
- `GET /api/negotiations/current` - frontend contract

## Local sandbox demo

1. Start a public HTTPS tunnel to port 3000 and set `PUBLIC_BASE_URL`.
2. Run `npm run provision` after changing prompts, tools, or the public URL.
3. Start the backend with `npm run server` and the frontend with `npm run dev` inside `auto-deal-navigator`.
4. Open `http://localhost:8080`, enter the minimal intake, and choose **Find and call sandbox provider**.

The UI should immediately show the discovered sandbox provider and queued/in-progress state. Tool calls save evidence while the call is live. The signed final webhook replaces partial turns with the complete transcript, materializes the quote, reconciles the total, and produces a recommendation. A negotiation callback starts only for a comparable reconciled quote whose deterministic recommendation is `COUNTER`.

## Tests

```bash
npm run typecheck
npm test
cd auto-deal-navigator && npm run lint && npm run build
```

The integration-focused suite covers VIN normalization, creation, benchmark promotion from estimated to verified local quotes, shared document intake, approval enforcement, offer/risk handling, recommendation, idempotent follow-up, terminal-state enforcement, tool/webhook security, policy honesty, money validation, and failure outcomes.

## HackNation compliance

- [x] One vertical closes intake -> calls -> negotiation -> ranked/recommended outcome in the implementation.
- [x] One durable spec is reused across calls.
- [x] Three distinct voice counterpart personas/human styles are supported.
- [x] Itemized structured quotes and structured call outcomes.
- [x] Verified leverage can produce a measurable revised offer.
- [x] AI disclosure, no-bluff policy, friction prompts, webhook/tool failure handling.
- [x] Transcript/provenance anchors and evidence-backed quote facts.
- [x] Human approval before calls and binding decisions.
- [~] Document intake accepts pasted text from an existing quote/bill and labels it as user-provided; OCR/file upload is not implemented.
- [~] ElevenLabs voice interview intake is not yet provisioned as a separate intake agent.
- [~] Recording URLs are not retained in the canonical report.
- [~] The complete live three-call golden run still requires valid telephony credentials and a reachable webhook during the demo.

These partial items are intentionally visible; the UI does not present mock data as live data or estimates as verified benchmarks.

## Strong demo script

Use the 2021 Volkswagen Tiguan scenario with front-camera calibration. Create the negotiation with a $650 target and $900 walk-away. Show that the benchmark is labeled `ESTIMATED`, confirm the spec, and approve calls. Run the three styles: a premium chain, hidden-fee lowballer, and vague mobile operator. Highlight the calibration checklist, structured decline/callback handling, and the lowball red flag. Then play the negotiation where the premium provider revises its all-in total only after the policy releases an exact verified competing quote. Finish on the recommendation, event history, and explicit final approval boundary.

See [AUDIT_AND_PLAN.md](AUDIT_AND_PLAN.md) for the repository-specific audit and [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) for the VIN, benchmark, call, leverage, and recommendation data flow.
