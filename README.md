# The Negotiator

The Negotiator is a human-controlled phone negotiation assistant for cash-pay auto-glass replacement. It creates one structured negotiation, labels benchmark quality, prepares a concise strategy, gathers itemized voice quotes, detects risks, allows only verified competitor leverage, recommends a next action, and remembers follow-ups until the negotiation closes.

The canonical product path is deliberately small:

`intake -> confirm spec -> approve calls -> gather offers -> analyze -> recommend -> follow up or close`

The AI never accepts, rejects, counters, shares sensitive information, books, pays, or confirms an agreement without an explicit user approval.

## Architecture

- One Fastify API: `server.ts`
- One workflow/state service: `negotiation-service.ts`
- One atomic JSON store: `store.ts` -> `.data/current-run.json`
- Deterministic policy and comparison rules: `policy.ts`
- One ElevenLabs/Twilio adapter: `scripts/`
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

Core local workflow requires none. Voice calls require:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_PHONE_NUMBER_ID`
- `TOOL_SHARED_SECRET`
- `PUBLIC_BASE_URL`
- `ELEVENLABS_WEBHOOK_SECRET`
- `PERSONA_TO_NUMBER`
- `PERSONA_PHONE_NUMBER_ID` for agent-to-agent mode (optional for human role-play)

`TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are used while configuring telephony. `OPENAI_API_KEY` and `OPENAI_MODEL` are optional and only used by the legacy report-prose fixture.

## Canonical API

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

## Voice demo

1. Create a negotiation in the UI.
2. Confirm the specification.
3. Approve outbound calls.
4. Start the public HTTPS tunnel and set `PUBLIC_BASE_URL`.
5. Run `npm run provision` once.
6. Use the negotiation ID shown in the UI:

```bash
npm run call:all -- --negotiation neg_... --to +15555550123
```

The runner refuses to call without `START_CALLS` approval, captures three styles, negotiates once using verified leverage, attaches offers to the canonical negotiation, and creates the recommendation.

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
