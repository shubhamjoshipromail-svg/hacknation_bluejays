# The Negotiator

An AI voice agent that phones auto-glass shops for you: it collects itemized windshield quotes over real phone calls, negotiates using only verified competing offers, and hands you a transparent recommendation — while a human stays in charge of every binding decision.

Built for HackNation with the ElevenLabs Conversational AI stack (voice + telephony), a deterministic Fastify backend that owns all money math and policy, and a React frontend that walks you through the whole run.

## The cycle

1. **Guided intake** — you describe the job once (VIN lookup via the official NHTSA vPIC API, damage, ZIP, scheduling). The VIN is decoded to detect ADAS/camera equipment so calibration is quoted correctly.
2. **The agent calls each configured provider.** Every call opens with a clear AI disclosure and a statement of exactly what it needs, then gathers an itemized, evidence-backed quote (base glass + install, calibration, mobile fee, moldings, disposal, tax, warranty).
3. **Negotiation round** — once at least two comparable quotes reconcile, the agent calls the higher shop back and may reveal an exact verified competing quote only after a deterministic policy gate approves it. No bluffing: if policy denies leverage, the agent never implies another offer exists.
4. **Recommendation and your choice** — deterministic red flags, a ranked comparison, and a plain-language recommendation. Accepting anything requires an explicit `ACCEPT_OFFER` approval from the human.
5. **Decision callback** — after your selection, the agent can call back to confirm the chosen offer. It still never books, pays, or commits on your behalf.

## Safety model

- The AI never accepts, rejects, counters, books, pays, or shares sensitive information without an explicit user approval.
- Every call opens with an AI disclosure and consent check.
- All prices are integer cents; totals must reconcile against line items before a quote is treated as comparable.
- Negotiation leverage is policy-gated and evidence-backed; benchmark ranges are labeled `ESTIMATED` until two reconciled quotes verify them, and are never used as competitor leverage.
- `CALL_MODE=SANDBOX` (the default and the demo mode) only ever dials the phone numbers **you** configure — nothing is discovered or dialed in the real world.

## Quickstart

Requires **Node.js 20+**. Clone the repo (or GitHub → *Code → Download ZIP* → unzip), then:

```bash
npm run setup     # installs backend + frontend deps and creates .env from the template
```

Fill in `.env` with **your own keys** (see Configuration below), then in two terminals:

```bash
npm run server            # backend API on :3000 (override with PORT)
```

```bash
cd auto-deal-navigator
npm run dev               # frontend on :8080
```

Open `http://localhost:8080`. The frontend talks to `http://localhost:3000` by default; set `VITE_API_URL` (see `auto-deal-navigator/.env.example`) if you run the backend elsewhere, and set `FRONTEND_ORIGIN` in `.env` to the exact frontend origin so CORS allows the browser.

> The UI and API run without any keys — you can browse the whole product and use VIN decoding immediately. Keys are only needed the moment you place real voice calls.

## Configuration — bring your own keys

Copy `.env.example` to `.env` and fill in:

| Variable | What it is |
|---|---|
| `ELEVENLABS_API_KEY` | Your ElevenLabs API key (Conversational AI enabled) |
| `ELEVENLABS_PHONE_NUMBER_ID` | An ElevenLabs-imported Twilio phone number id used as the outbound caller |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Used while configuring telephony |
| `PUBLIC_BASE_URL` | Public HTTPS tunnel to your backend (e.g. ngrok) so ElevenLabs tools/webhooks can reach it |
| `TOOL_SHARED_SECRET` | Any strong random string; authenticates ElevenLabs tool calls to `/tools/*` |
| `ELEVENLABS_WEBHOOK_SECRET` | HMAC secret from the ElevenLabs post-call webhook settings |
| `CALL_MODE` | Keep `SANDBOX` — calls only go to numbers you configure |
| `SANDBOX_PROVIDER_NAME` / `SANDBOX_PROVIDER_NUMBER` | Provider #1: a phone number you own for testing |
| `SANDBOX_PROVIDER_2_*`, `SANDBOX_PROVIDER_3_*` | Optional providers #2/#3 — quote calls then run sequentially and unlock the comparison + negotiation round |
| `PORT`, `FRONTEND_ORIGIN` | Backend port and the exact browser origin allowed by CORS |

### Wiring ElevenLabs (one time, ~5 minutes)

1. Start your tunnel: `ngrok http 3000` and put the HTTPS URL in `PUBLIC_BASE_URL`.
2. `npm run provision` — creates/updates the five ElevenLabs agents (intake, negotiation, and three shop personas), registers the authenticated tools against your `PUBLIC_BASE_URL`, and writes their ids to `agents.json`. **Re-run it whenever you change prompts, tools, or the tunnel URL.**
3. In the ElevenLabs dashboard, point the post-call webhook at `PUBLIC_BASE_URL/webhooks/elevenlabs` with `ELEVENLABS_WEBHOOK_SECRET`.

### Testing with your own phone numbers

This is how we demo it, and how judges can try it: put phone numbers you control in the `SANDBOX_PROVIDER_*` slots, submit an intake in the UI, and answer the calls yourself playing the shop. The transcript, extracted facts, itemized quote, and negotiation all populate live in the UI. Nothing ever dials a number that is not in your `.env`.

## Architecture

- One Fastify API: `server.ts`
- One workflow/state service: `negotiation-service.ts`
- One atomic JSON store: `store.ts` → `.data/current-run.json`
- Deterministic policy and comparison rules: `policy.ts`
- One direct ElevenLabs/Twilio call adapter: `elevenlabs-call-service.ts`
- One sandbox discovery adapter: `provider-search-service.ts`
- One automatic orchestrator: `workflow-service.ts`
- One adaptive call-state engine: `call-intelligence.ts`
- One source-backed benchmark bridge: `benchmark-service.ts` → `benchmarking/`
- One React/TanStack frontend: `auto-deal-navigator/` (Your Job → Live Calls → Compare Quotes → Negotiation → Recommendation)

The legacy text loop (`textloop.ts`) and three YAML personas remain as a labeled golden-path evaluation fixture. They are not the source of product state.

## API (integrate it into your own product)

The backend is a plain HTTP API — the bundled frontend is just one client of it.

Primary flow:

- `POST /api/runs` — minimal vehicle/service intake; discovers the configured sandbox provider(s), persists a run, and starts the quote call asynchronously
- `GET /api/negotiations/current` — the complete canonical run (state, providers, calls, transcripts, offers, red flags, recommendation); poll this to drive any UI
- `GET /api/vin/:vin` — official NHTSA vPIC decode with normalized ADAS evidence
- `POST /tools/:toolName` — authenticated ElevenLabs tool endpoints (call evidence, quote fields, terms, outcomes)
- `POST /webhooks/elevenlabs` — authenticated final-transcript ingestion, quote reconciliation, recommendation, and eligible negotiation kickoff

Lower-level endpoints for validation, tests, and adapters:

- `POST /api/negotiations/from-vin` — canonical VIN-first intake
- `POST /api/negotiations` — validated intake used by tests and adapters
- `POST /api/negotiations/:id/documents` — paste text from an existing quote/bill into the spec
- `POST /api/negotiations/:id/approvals` — explicit approval checkpoint
- `POST /api/negotiations/:id/offers` — transcript-backed structured offer
- `POST /api/negotiations/:id/recommendation` — deterministic next action
- `POST /api/negotiations/:id/follow-ups` — idempotent recall task
- `POST /api/negotiations/:id/close` — terminal state; acceptance requires `ACCEPT_OFFER`

The VIN is optional in intake. If supplied it is a private specification field: the voice agent says it only when the provider explicitly asks.

## Adaptive conversation brain

The intake agent does not follow a mandatory question order. It starts with `get_call_state`, records every explicit fact from each provider answer with one `record_provider_answer` call, and chooses its next move from critical gaps, optional gaps, contradictions, and completion status returned by the backend. One answer can resolve multiple facts; repeated facts are idempotent; conflicting money requires an explicit correction before it replaces the prior value. Questions are conditional on intake and call state — for example, ADAS details are not required when the vehicle is known not to have a front camera.

Buyer agents use Eleven v3 Conversational with Expressive Mode. The disclosure opening is non-interruptible, later turns remain interruptible, and spoken confirmation finishes before the single silent `close_call` action. Phone audio is Twilio-compatible μ-law at 8 kHz.

The separate benchmarking vertical runs before call dispatch. Its bundled source-derived evidence supplies a labeled directional range, warnings, and call guidance; only two or more reconciled same-scope provider quotes can promote that range to `VERIFIED`. Run it independently with `npm run benchmark -- benchmarking/examples/request.json --offline`.

## Tests

```bash
npm run typecheck
npm test
cd auto-deal-navigator && npm run lint && npm run build
```

The integration-focused suite covers VIN normalization, creation, benchmark promotion, shared document intake, approval enforcement, offer/risk handling, recommendation, idempotent follow-up, terminal-state enforcement, tool/webhook security, policy honesty, money validation, and failure outcomes.

## Demo script

Use the 2021 Volkswagen Tiguan scenario (VIN `3VV2B7AX0MM103995`) with front-camera calibration. Decode the VIN in the intake, confirm the spec, and submit. Run the three shop styles: a premium chain, a hidden-fee lowballer, and a vague mobile operator. Highlight the calibration checklist, structured decline/callback handling, and the lowball red flag. Then play the negotiation where the premium provider revises its all-in total only after policy releases an exact verified competing quote. Finish on the recommendation, event history, and the explicit final approval boundary.

## HackNation compliance

- [x] One vertical closes intake → calls → negotiation → ranked/recommended outcome in the implementation.
- [x] One durable spec is reused across calls.
- [x] Three distinct voice counterpart personas/human styles are supported.
- [x] Itemized structured quotes and structured call outcomes.
- [x] Verified leverage can produce a measurable revised offer.
- [x] AI disclosure, no-bluff policy, friction prompts, webhook/tool failure handling.
- [x] Transcript/provenance anchors and evidence-backed quote facts.
- [x] Human approval before calls and binding decisions.
- [~] Document intake accepts pasted text from an existing quote/bill; OCR/file upload is not implemented.
- [~] ElevenLabs voice interview intake is not yet provisioned as a separate intake agent.
- [~] Recording URLs are not retained in the canonical report.
- [~] The complete live three-call golden run requires valid telephony credentials and a reachable webhook during the demo.

These partial items are intentionally visible; the UI never presents mock data as live data or estimates as verified benchmarks.

## More docs

See [AUDIT_AND_PLAN.md](AUDIT_AND_PLAN.md) for the repository audit and [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) for the VIN, benchmark, call, leverage, and recommendation data flow.
