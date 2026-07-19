# FINAL PROJECT DOCUMENTATION — The Negotiator

**Repository:** `shubhamjoshipromail-svg/hacknation_bluejays` · **Documented against:** remote `origin/main` @ `7dfc276` ("style: format merged frontend") plus local commit `8182510` (see §2) · **Generated:** July 19, 2026, from direct inspection of code, configuration, tests, git history, and runtime data. Claims are cited to files; nothing is asserted from prior summaries without verification.

---

## 1. Executive system overview

**What the product is.** The Negotiator is a voice-agent system for the Hack-Nation × ElevenLabs challenge: an AI buyer agent that gathers itemized windshield-replacement quotes for one specific vehicle (a real 2021 Volkswagen Tiguan, VIN-verified) from three simulated auto-glass shop counterparties, negotiates a better price using only policy-verified competing quotes, and produces a ranked, provenance-cited comparison. The chosen vertical is cash-pay auto-glass replacement; the design premise is that a VIN makes quotes exactly comparable and ADAS camera recalibration is the characteristic hidden fee.

**Problem addressed.** Phone-priced local markets (documented in `research/`) exhibit opaque pricing, bait headline quotes with undisclosed fees, and no practical way for a consumer to gather comparable itemized quotes. The system automates spec-consistent quote gathering, forced fee itemization, honest leverage-based negotiation, and evidence-backed recommendation.

**Main user experience (as implemented).** There is no interactive intake UI. A hard-coded, confirmed job specification (`config.ts`) drives everything. Runs are executed from the command line (`npm start` for the fully simulated text loop; `npm run call` / `npm run call:all` for live phone calls via ElevenLabs + Twilio). Results accumulate in a JSON run store served over HTTP; a separate React dashboard (`auto-deal-navigator/`) displays job spec, live calls, quote comparison, negotiation timeline, and recommendation screens.

**Central workflow.** Confirmed spec → three quote conversations (text-simulated or live voice) → deterministic normalization and red-flag analysis → policy engine mints "verified facts" from reconciled quotes → negotiation callback using only the exact policy-approved sentence → revised offer recorded as a new immutable version → deterministic ranking → run snapshot served at `GET /runs/current`.

**Degree of end-to-end integration (verified):**
- Text-mode loop: **fully implemented and executed**; a complete run (3 quotes + 1 successful negotiation, $780 → $680) is persisted in `.data/current-run.json`.
- Voice: **implemented and partially exercised live** — real outbound Twilio calls have been placed by the provisioned buyer agent (including a graceful voicemail-decline outcome); a complete 4-call voice golden run is **not** evidenced in the run store.
- Frontend: **implemented, merged, and NOT live-integrated** — it polls the backend endpoint but a contract mismatch (§7) means it permanently renders its own mock data.
- Real (non-simulated) businesses: **never called by the system**; counterparties are LLM personas or a human answering a phone.

**Real vs. mocked at a glance:** policy engine, playbook, tools, store, ranking, prompts, provisioning, telephony calls — real code, executed. Frontend display data — mock fallback in practice. Counterparty market — simulated personas by design. Document/photo intake, voice intake interview, provider discovery (Google Places/Yelp) — **not present in code** (research-only concepts).

## 2. Repository state and history

- Remote `origin/main` HEAD: `7dfc276` — "style: format merged frontend". Working tree at time of writing: local `main` is **ahead 1 / behind 13** relative to `origin/main`.
- The local-ahead commit `8182510` ("voice tuning: state-tracked fee checklist, critical reminders at prompt end, turn timeout 7s") contains backend changes **absent from the remote**: `tools.ts` checklist-state feedback in tool responses, a `## CRITICAL REMINDERS` block ending `prompts.ts`, `turn_timeout: 7`, buyer voice `pqHfZKP75CvOlQylNhV4` (Bill), `temperature: 0.45`. Remote `origin/main` still has buyer voice `21m00Tcm4TlvDq8ikWAM` (Rachel), `temperature: 0`, `turn_timeout: 12` (verified via `git show origin/main:scripts/provision-agents.ts`).
- A `git pull --rebase` initiated from the documentation environment failed on mounted-filesystem permission errors (`.git` unlink denied); the divergence persists and is recorded here as fact.
- Implementation streams now present in the repository: (a) the backend/agent stream developed on sequential feature branches (`0659b88` text loop → `8be5e2c` playbook → `16a7525` VIN fix (PR #6) → `c2bacaa` Phase-2 voice transport (PR #7) → `1670b51` CORS (PR #8) → `e1ce37f` M2 buyer-config merge); (b) the frontend stream from `feat/auto-deal-navigator-app` (Lovable-generated TanStack Start app), merged into `main` and formatted at `7dfc276`; (c) research and challenge materials under `research/`; (d) the historical starter kit as `STARTER_KIT.md`.
- Untracked local noise: `.DS_Store`, `.claude/settings.local.json`. Ignored-but-present operational files: `.env` (all 12 variables populated except `PERSONA_PHONE_NUMBER_ID`, which is empty), `agents.json` (4 provisioned agent IDs), `.data/current-run.json` (persisted run).

## 3. Complete repository map

```
/                              backend + agent system (root-level TypeScript, ESM)
├── domain.ts                  Zod schemas: JobSpec, QuoteOffer/QuoteLineItem, CallOutcome,
│                              VerifiedFact, PolicyDecision, Recommendation, ProvenanceAnchor,
│                              Money (integer cents), Knowable(UNKNOWN). Imported by every
│                              other backend module. ACTIVE — the shared contract.
├── policy.ts                  Deterministic policy engine: mintCompetitorOfferFact (4
│                              eligibility rules), requestLeverage (deny-by-default, max 3
│                              rounds, never a provider's own quote), computeKnownTotal
│                              (UNKNOWN ≠ 0), applyRedFlags (CALIBRATION_OMITTED,
│                              SUSPICIOUS_LOWBALL ≥30% below median, TOTAL_MISMATCH),
│                              rankQuotes (weights 45/20/15/10/10, visible penalties),
│                              freezeSpecCore (canonical-JSON sha256). ACTIVE.
├── playbook.ts                Loads negotiation-playbook.yaml; planNegotiation() filters
│                              tactics by honesty class vs. authorization; logTimeline()
│                              emits [TACTIC]/[TRIGGER] events to store. ACTIVE.
├── negotiation-playbook.yaml  9 named tactics (Voss/Fisher&Ury/Cialdini-derived) with
│                              honesty classes, phrasing patterns, persona-conditioned
│                              selection_rules, excluded_forever deception list. Runtime
│                              config, loaded by playbook.ts. ACTIVE.
├── prompts.ts                 BUYER_FIRST_MESSAGE (AI + recording disclosure);
│                              BUYER_PROMPT (identity, non-negotiable honesty rules,
│                              concision rules, phase-branched call flows for
│                              QUOTE_COLLECTION and NEGOTIATION, friction handling; local
│                              commit adds STATE TRACKING + CRITICAL REMINDERS);
│                              buyerPrompt(provider, policyAllow) appends allowed tactics;
│                              personaPrompt(id) renders persona YAML into a system prompt
│                              with private-economics pricing rules. ACTIVE.
├── persona.premium_chain.yaml         "ClearView Auto Glass": itemizes, asks-if-AI, cost
│                                      floor $560, target $840, price-match/waive triggers.
├── persona.independent_lowballer.yaml "Rick's Discount": $285 headline, $300 calibration
│                                      revealed only on direct ask, interrupts, no written
│                                      confirmation.
├── persona.mobile_operator.yaml       "GlassGo Mobile": vague ranges, callback pressure,
│                                      manager-approval concession. All three loaded at
│                                      runtime by prompts.ts/provisioning. ACTIVE.
├── config.ts                  Hard-coded confirmed JobSpec for the real demo vehicle
│                              (2021 VW Tiguan, VIN 3VV2B7AX0MM103995, FRONT_CAMERA,
│                              cash-pay, ZIP 28202, mayBook:false), spec hash, CALL_BRIEF
│                              text + hash. ACTIVE — single source of job truth.
├── store.ts                   RunStore (transcriptTurns, provenance, drafts, quotes,
│                              outcomes, verifiedFacts, policyDecisions, timelineEvents,
│                              ranking:null-able); JSON persistence to .data/current-run.json
│                              (atomic tmp+rename, mode 600); mutate()/snapshot()/loadStore().
│                              In-memory + file; no database. ACTIVE.
├── tools.ts                   The 8 agent tools (get_call_brief, log_quote_item,
│                              log_quote_total, log_term, mark_unknown, request_leverage,
│                              record_counteroffer, close_call) + dispatchTool() voice
│                              adapter creating transcript turns and provenance anchors;
│                              close_call materializes a QuoteOffer from the call draft.
│                              Local commit adds logged/remaining checklist feedback. ACTIVE.
├── textloop.ts                Text-only closed loop: OpenAI Responses-API buyer vs persona
│                              conversations, tool execution, normalizeAndMint, negotiation
│                              round, red flags, ranking, strict GATE (exits non-zero on
│                              violation incl. fake-leverage DENY check). ACTIVE (also the
│                              regression harness for the voice path).
├── server.ts                  Fastify server: POST /tools/:toolName (x-tool-secret auth),
│                              POST /webhooks/elevenlabs (HMAC signature verification on
│                              raw body), GET /runs/current (snapshot), GET /health;
│                              wildcard CORS on GET. ACTIVE.
├── scripts/elevenlabs-api.ts  Thin authenticated fetch wrapper for api.elevenlabs.io. ACTIVE.
├── scripts/provision-agents.ts Idempotent creation of 4 ElevenLabs agents (buyer + 3
│                              personas) with voices, first messages (persona shop
│                              greetings), turn settings, gemini-2.5-flash, ulaw_8000
│                              telephony formats, webhook tools bound to PUBLIC_BASE_URL,
│                              shared-secret header as ElevenLabs secret; writes agents.json.
│                              ACTIVE.
├── scripts/run-call.ts        Call runner: assigns persona agent to inbound number when
│                              PERSONA_PHONE_NUMBER_ID is set, else logs "Human shop-roleplay
│                              mode"; initiates POST /v1/convai/twilio/outbound-call with
│                              dynamic variables + per-call buyer prompt override; polls
│                              conversation status; --all runs 3 quote calls →
│                              normalizeAndMint → negotiation call vs highest reconciled
│                              quote → gate print. ACTIVE.
├── policy.test.ts             Vitest: policy invariants (incl. empty-facts DENY). ACTIVE.
├── server.test.ts             Vitest: server auth/webhook/read endpoints. ACTIVE.
├── package.json               Scripts: start/textloop/server/provision/call/call:all/test/
│                              typecheck. Deps: fastify, openai, zod, yaml, dotenv; dev:
│                              tsx, typescript, vitest. ACTIVE.
├── STARTER_KIT.md             Historical: the original M1 starter-kit README (pre-
│                              consolidation instructions referencing a packages/ layout
│                              that was never adopted — flat root layout was used instead).
│                              HISTORICAL ARTIFACT.
├── AGENTS.md / CLAUDE.md      Rules for coding agents working on the repo (branching, no
│                              force-push, PR discipline). Governs development workflow,
│                              NOT product runtime. CLAUDE.md is a one-line include of
│                              AGENTS.md.
├── research/                  Strategy & analysis documents (§16) + 6 challenge-brief PDFs.
│                              NON-EXECUTABLE reference material.
└── auto-deal-navigator/       Frontend (React 19, TanStack Start/Router, Vite, Tailwind,
    │                          shadcn/Radix; Lovable-originated: .lovable/project.json,
    │                          lovable-error-reporting.ts; bun.lock + bunfig.toml).
    ├── src/hooks/use-runs-data.ts   Polls RUNS_URL every 3s; VITE_RUNS_API_URL or
    │                                placeholder https://your-ngrok-url.ngrok.app/runs/current;
    │                                silent catch → mock data; isNonEmpty() gate requires
    │                                jobSpec + quotes.length>0 + arrays. ACTIVE (mock-serving
    │                                in practice, §7).
    ├── src/lib/mock-data.ts         Frontend type definitions AND the mock dataset
    │                                (JobSpec, Quote w/ embedded transcriptTurns+events,
    │                                PolicyDecision, RankingEntry; formatMoney, totalMinor,
    │                                hasUnknown helpers). ACTIVE as both contract and data.
    ├── src/routes/                  index.tsx (Job Spec), calls.tsx (Live Calls),
    │                                compare.tsx (quote table w/ 6 fee categories, red
    │                                flags, evidence), negotiation.tsx (timeline, policy
    │                                log), recommendation.tsx (ranking, explanations);
    │                                __root.tsx shell + sidebar + demo banner.
    ├── src/components/              app-sidebar, demo-banner ("SIMULATED PROVIDER MARKET"),
    │                                ui-bits (SourceTag, HashChip), ui/* (48 shadcn files).
    └── src/server.ts, start.ts, router.tsx, routeTree.gen.ts  TanStack Start scaffolding
                                     (routeTree.gen.ts is GENERATED).
```

## 4. Product and user workflow (as implemented)

1. **Spec definition** — `config.ts` exports the confirmed `jobSpec` with `coreSha256` (from `freezeSpecCore`, `policy.ts`) and a fixed `CALL_BRIEF` string + hash. There is no runtime intake; VIN was verified externally against NHTSA vPIC (decode result referenced in `research/` and chat-of-record; not called from code).
2. **Text run** (`npm start` → `textloop.ts`): for each persona, a two-LLM conversation (OpenAI Responses API; buyer with function-calling against the 8 tools, persona from `personaPrompt()`); every spoken turn recorded via `recordTurn()`; every logged number gets a `ProvenanceAnchor` to its turn.
3. **Voice run** (`npm run call`/`call:all` → `scripts/run-call.ts`): outbound call created via ElevenLabs `POST /v1/convai/twilio/outbound-call` with dynamic variables (`call_id`, `provider_id`, `call_brief_text`, `phase`, `allowed_concessions`) and a per-call buyer-prompt override; mid-call the ElevenLabs agent invokes webhook tools → `server.ts` → `dispatchTool()`; post-call transcription arrives at `/webhooks/elevenlabs` (HMAC-verified) and is ingested into the store. If `PERSONA_PHONE_NUMBER_ID` is unset (current state), persona assignment is skipped and the call dials `PERSONA_TO_NUMBER`/`--to` — human-roleplay mode.
4. **Normalization** (`normalizeAndMint` in both runners): `computeKnownTotal` (UNKNOWN never zero), stated-vs-computed reconciliation (`TOTAL_MISMATCH` if mismatched), `applyRedFlags`, then `mintCompetitorOfferFact` for every reconciled comparable quote — producing `VerifiedFact`s each with an exact `allowedClaim` sentence.
5. **Negotiation** — second call to the highest reconciled quoter with `phase=NEGOTIATION`; the buyer may only speak a competitor figure after `request_leverage` returns ALLOW (logged as a `PolicyDecision`); persona concessions fire only on YAML triggers (logged `[TRIGGER]`); improvements recorded via `record_counteroffer` as a new immutable offer version (`stage: NEGOTIATED`).
6. **Ranking & gate** — `rankQuotes` (deterministic, penalties visible); textloop enforces the strict gate (3 structured outcomes, ≥1 minted fact, negotiated version cheaper, empty-facts leverage DENIED, 100% provenance) and exits non-zero on failure.
7. **Serving & display** — every mutation persists to `.data/current-run.json`; `GET /runs/current` returns the snapshot; the frontend polls it every 3 s but, due to §7, currently renders `mock-data.ts` contents.
8. **Failure paths implemented:** tool auth failure → 401; tool error → `{error, fallback:"Let me double-check and follow up."}`; webhook bad signature → 401; voicemail → close_call `DECLINED` with structured reason (observed live: conversation `conv_5801kxw6wtzqfj7sntxm9hfrnjhw`, 118 s); dropped/turn-cap → `DROPPED`; frontend fetch failure → silent mock retention.

## 5. Backend architecture

**Runtime:** Node (ESM) + `tsx`; TypeScript strict; Zod runtime validation at the schema layer; Fastify 5 server; Vitest tests; no database (JSON file store); no auth layer beyond the two shared secrets; logging via console (`[TACTIC]`/`[TRIGGER]`/gate output) — no structured logger.

**API endpoints (`server.ts`):**

| Method | Route | Auth | Purpose / behavior | Consumer |
|---|---|---|---|---|
| POST | `/tools/:toolName` | `x-tool-secret` header must equal `TOOL_SHARED_SECRET` (401 otherwise; 404 unknown tool) | Executes one of the 8 tools via `dispatchTool()`; returns `{ok, result}`; on error 400 `{error, fallback}`; `server-timing` header reports tool duration | ElevenLabs webhook tools during live calls |
| POST | `/webhooks/elevenlabs` | HMAC `elevenlabs-signature` verified against raw body (`ELEVENLABS_WEBHOOK_SECRET`, falls back to `TOOL_SHARED_SECRET`) | Ingests post-call transcription events into the store; 401 invalid/stale; 400 malformed | ElevenLabs cloud |
| GET | `/runs/current` | none; CORS `*` | Returns `snapshot()` — the entire RunStore | Frontend `useRunsData` (intended); any reader |
| GET | `/health` | none | `{ok:true}` | ops |

**Store lifecycle:** module-load `loadStore()`; every `mutate()` persists atomically; `snapshot()` is a `structuredClone`. `RUN_STORE_PATH` env override supported (used by tests). Single-run model — no run IDs, one current store.

**Known implementation limits evidenced in code:** `ranking` in the store is `unknown|null` and only populated by the runners' gate/print step (not by the server); no pagination/multi-run; drafts keyed by `call_id` never garbage-collected; webhook ingestion trusts payload conversation IDs for correlation.

## 6. Frontend architecture

**Stack:** React 19, TanStack Start + TanStack Router (file-based routes, `routeTree.gen.ts` generated), Vite build, Tailwind (`styles.css`), shadcn/ui over Radix (48 vendored components), lucide-react icons, dark professional theme. Package manager: bun (`bun.lock`, `bunfig.toml`). Scripts: `dev`, `build`, `build:dev`, `preview`, `lint` (eslint), `format` (prettier).

**Screens:** `/` Job Spec (confirmed spec card, masked VIN, source tags VOICE/DOCUMENT/NHTSA, hash chip) · `/calls` Live Calls (per-provider status, transcript pane, event feed) · `/compare` (itemized table across the 6 display categories, UNKNOWN badges, red-flag chips, evidence drawer) · `/negotiation` (original→revised timeline, `[TACTIC]`/`[TRIGGER]` events, policy ALLOW/DENY log incl. a DENY row) · `/recommendation` (ranked entries, component-score bars, penalties, explanation). Persistent "SIMULATED PROVIDER MARKET" demo banner component.

**Data flow:** single hook `useRunsData` → initial state = MOCK → fetch `RUNS_URL` every 3000 ms (`cache:"no-store"`) → replace state only if `isNonEmpty(json)` → silent catch on any error. `RUNS_URL = VITE_RUNS_API_URL ?? "https://your-ngrok-url.ngrok.app/runs/current"` — **the placeholder URL is still present in current code**; no `.env` file for the frontend is committed.

**Verification of previously observed conditions (all checked against `origin/main` @ 7dfc276):** merged from `feat/auto-deal-navigator-app` — TRUE (git history; `.lovable/project.json` present). Polls `GET /runs/current` — TRUE. Placeholder ngrok URL — TRUE (unchanged). Silent mock fallback — TRUE. Expects `jobSpec`, non-empty `quotes`, `policyDecisions`, `ranking` — TRUE (`isNonEmpty`). Backend response missing expected fields / `ranking` nullable — TRUE and still current (§7).

## 7. Frontend-to-backend contract analysis

Backend truth: `snapshot()` of `RunStore` (`store.ts`). Frontend expectation: `RunsData` (`use-runs-data.ts`) with types from `mock-data.ts`.

| Field | Frontend expectation | Backend output | Status | Evidence |
|---|---|---|---|---|
| `jobSpec` | Required object (hash, vehicle, vin, requirements…) — gate condition | **Absent entirely** from snapshot | **MISSING → gate always fails → UI stays on mock** | `store.ts` RunStore; `use-runs-data.ts` `isNonEmpty` |
| `quotes` | `Quote[]` with `provider`, `location`, `callStatus`, `jobSpecHash`, embedded `transcriptTurns[]`, embedded `events[]`, `redFlags: string[]`, `originalOfferMinor`/`revisedOfferMinor` | `QuoteOffer[]` with `providerId`, `stage`, `totals{...}`, `lineItems[]` (compatible shape), `redFlags: {code,detail}[]`; transcripts/events are top-level stores, not embedded | **SHAPE MISMATCH** (names + nesting + flag type) | `mock-data.ts` vs `domain.ts` |
| `policyDecisions` | `{id, decision, allowedStatement?, denyReason?, timestamp}` | `{decisionId, callId, requested, decision, factIds, allowedStatement, denyReason, round, at}` | **RENAMED/SUPERSET** (`id`≠`decisionId`, `timestamp`≠`at`) — array exists, so gate passes this leg | both type files |
| `ranking` | `RankingEntry[]` with `provider`, `componentScores{price,completeness,trust,logistics}`, `explanation` | `unknown | null`; when populated (by runners) uses `quoteId`, `componentScores{price,completeness,scopeQuality,schedule,terms}`, no `explanation` | **NULLABLE + SHAPE MISMATCH** | `store.ts`; `policy.ts` `rankQuotes` |
| `transcriptTurns` | Embedded per quote, `speaker: AGENT|SHOP`, `timestamp mm:ss` | Top-level `Record<turnId, Turn>`, `speaker: BUYER_AGENT|PROVIDER|USER`, no timestamp | **STRUCTURAL MISMATCH** | both |

**Conclusion (current state):** the wire is connected (CORS open, endpoint live, poller running) but the contract is not — the system is **partially connected**: backend serves real data; frontend displays mock data permanently because `jobSpec` is absent and shapes differ. No adapter/transformation layer exists in either direction.

## 8. Domain model and system state

All entities in `domain.ts` (Zod, strict): **JobSpec** (spec core incl. vehicle w/ 17-char VIN + verification enum, damage, requirements, serviceArea `AFTER_SELECTION` disclosure, schedule, authorization with literal `mayBook:false`; `callBrief{text,sha256}`; `confirmation{coreSha256}`) — created statically in `config.ts`; never mutated. **QuoteOffer / QuoteLineItem** (integer-cent money; `status INCLUDED|EXCLUDED|NOT_APPLICABLE|UNKNOWN`; `provenanceIds` min 1 — a number without evidence is unrepresentable; `offerVersion`/`stage` for immutable renegotiated versions; `comparability`; `redFlags[]`) — created by `close_call` materialization (voice) or textloop; mutated only by appending new versions. **CallOutcome** (QUOTED/CALLBACK_REQUIRED/DECLINED/DROPPED + mandatory non-empty reason). **VerifiedFact** (kind, amountMinor, scopeHash, provenanceIds, exact `allowedClaim`, status) — minted exclusively by `mintCompetitorOfferFact`. **PolicyDecision** (ALLOW/DENY, released statement or denyReason, round 1–3) — appended by every `request_leverage`. **ProvenanceAnchor** (conversationId, turnId, excerpt, claimType, extractionMethod, confidence). **Recommendation** schema exists in `domain.ts`; the store's `ranking` field is populated with `rankQuotes` output rather than a full `Recommendation` object. Store-local types: `Turn`, `TimelineEvent` (TRIGGER/TACTIC/RECONCILE_WARN), `VoiceDraft` (per-call accumulation before quote materialization).

## 9. Agentic and negotiation workflow

**Agents (4, provisioned in ElevenLabs — IDs in `agents.json`):** buyer/negotiator (tools; phase-branched prompt), and three counterparty personas (no tools; private cost models injected into system prompts). No researcher/manager/critic agents exist.

**Deterministic vs model-driven:** all money arithmetic, comparability, red flags, leverage authorization, concession-round limits, ranking, and state transitions are deterministic TypeScript (`policy.ts`, `tools.ts`). LLMs produce conversation text and decide *when* to call tools. The buyer cannot originate a competitor claim: `request_leverage` with no eligible facts returns DENY with an explicit instruction that it may not imply competing offers (tested in `policy.test.ts`).

**Negotiation sequence (implemented):** quote calls (no negotiation permitted in QUOTE_COLLECTION prompt) → mint facts → callback opens "customer is ready to make a decision… any flexibility?" → round 1 PRICE_MATCH with exact `allowedClaim` verbatim → round 2 WAIVE_FEE (optionally trading a user-authorized concession: in-shop, weekday flexibility) → hard stop after 3 rounds → `record_counteroffer` (validated: integer cents, strictly lower) → structured close. Persona-side: concessions only on YAML triggers; refusal below `cost_floor_minor`; behaviors (interrupting, evasion, manager-hold) defined per persona.

**Playbook governance:** `planNegotiation` selects tactics by persona style and filters by honesty class — `TRUTHFUL_REQUIRES_POLICY_ALLOW` tactics are only injected when a policy ALLOW exists (enforced in code, `playbook.ts`); deception tactics are absent from the tactic set by construction (`excluded_forever` is documentation of that absence).

**Human interaction points:** human may answer calls as the counterparty (roleplay mode — the active mode while `PERSONA_PHONE_NUMBER_ID` is empty). No human-approval gate is implemented in code for initiating calls (approval concepts appear in research docs only). Booking/payment is structurally impossible (`mayBook:false` literal; no such tool exists).

**Simulation boundaries:** counterparty market is simulated by design (challenge-sanctioned); the voicemail-decline path ran against a real phone. Research-only concepts NOT in code: voice intake interview, document/photo intake, provider discovery, callback scheduling, multi-vertical config swapping (a junk-removal YAML exists in research docs, not as a loadable vertical config).

## 10. Policies, personas, rules, and governance

`negotiation-playbook.yaml` — runtime-loaded (verified import in `playbook.ts`); controls tactic availability and phrasing. `persona.*.yaml` (3) — runtime-loaded by `personaPrompt()` and provisioning; each contains `private` economics (cost floor, target, line items, triggers/actions, refusal conditions) and `public` behavior (itemizes?, interrupts?, asks-if-AI?, validity, friction notes). Premium chain specifics: floor $560.00, target $840.00, waive-mobile on verified-competitor-within-10%, match-to-$760 on verified-below-$760, $50 off for in-shop+off-peak, refuses vague competitor claims. `prompts.ts` honesty rules are the buyer-side governance (never invent, verbatim-only leverage, no booking). `AGENTS.md`/`CLAUDE.md` govern **coding agents' git workflow**, not the product runtime (note: several later commits were pushed directly to `main`, diverging from the AGENTS.md PR rule — documented as fact). Safeguards present in code: tool-secret auth, webhook HMAC, spec hash, provenance-mandatory line items, deny-by-default leverage, 3-round cap, counteroffer validation, structured close requirement.

## 11. Data architecture

- **Job/spec data:** hard-coded in `config.ts` (real VIN of a real vehicle; masked display only in the frontend mock — the backend snapshot exposes the full VIN to any reader of `/runs/current`, which is unauthenticated).
- **Runtime state:** `.data/current-run.json` — single JSON document, atomic writes, mode 600. Current committed-adjacent contents (untracked): a complete **text-mode** run — 61 transcript turns, 25 provenance anchors, 4 outcomes (all QUOTED), 4 quotes (premium `INITIAL` $780.00 → `NEGOTIATED` $680.00; lowballer $627.00 w/ `HEADLINE_PRICE_OMITTED_FEES` flag; mobile $630.00), 3 VerifiedFacts, 1 ALLOW PolicyDecision, timeline events, 6-entry ranking. Timestamps cluster in one second (2026-07-19T02:03:44Z) — machine-speed text simulation, not voice.
- **Mock data:** `auto-deal-navigator/src/lib/mock-data.ts` — the dataset the UI currently displays; deliberately mirrors the product narrative ($780→$680-style story) but is not generated from the backend.
- **Agent registry:** `agents.json` (4 ElevenLabs agent IDs; mode 600).
- **Secrets:** `.env` (gitignored; 12 variables; `PERSONA_PHONE_NUMBER_ID` empty). `.env.example` documents all names.
- **Research data:** markdown/PDF only. No database, no external dataset, no analytics pipeline exists in code.

## 12. External APIs and integrations

| Service | Purpose | Files | Env vars | Status |
|---|---|---|---|---|
| **OpenAI** (Responses API) | Buyer & persona LLMs in text loop; optional report prose | `textloop.ts` | `OPENAI_API_KEY`, `OPENAI_MODEL` | Live, executed (run store is its output); prose step skips gracefully without key |
| **ElevenLabs Agents** | Voice agents, outbound Twilio calls, conversations, webhook tools, post-call transcription | `scripts/elevenlabs-api.ts`, `provision-agents.ts`, `run-call.ts`, `server.ts` | `ELEVENLABS_API_KEY`, `ELEVENLABS_PHONE_NUMBER_ID`, `PERSONA_PHONE_NUMBER_ID` (empty), `ELEVENLABS_WEBHOOK_SECRET` | Live and exercised: 4 agents provisioned; real outbound calls placed incl. voicemail-decline; agent LLM `gemini-2.5-flash` (Google model selected *within* ElevenLabs — no direct Google integration) |
| **Twilio** | Phone numbers + telephony under ElevenLabs native integration | via ElevenLabs; creds in `.env` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `PERSONA_TO_NUMBER` | Live; one imported number; second number **not** imported (empty ID) — persona line currently a human phone |
| **ngrok** | Public tunnel for tools/webhooks | `PUBLIC_BASE_URL` usage in provisioning/server docs | `PUBLIC_BASE_URL`, `NGROK_AUTHTOKEN` | Operational during sessions; frontend still carries a **placeholder** ngrok URL default |
| **NHTSA vPIC** | VIN decode (research/validation) | referenced in `research/`; **no code calls it** | — | Research-only; decode performed manually during development |
| Google Places / Yelp / RepairPal / NAGS etc. | Provider discovery & benchmarks | `research/` documents only | — | Research-only; absent from code |

## 13. MCP architecture and connectivity

Explicit search performed (`grep -ri "mcp|model context protocol"` across tracked files): **no MCP client, server, tool definition, transport, or configuration exists in the repository.** MCP appears only as a passing mention inside research documents (e.g., the challenge brief's hint list and `research/negotiator-build-ready-architecture.md`). The product's tool-calling uses ElevenLabs webhook tools over plain HTTPS with a shared-secret header — not MCP. No MCP implementation is scaffolded or partially present.

## 14. Voice, messaging, and conversation systems

Channels: outbound PSTN voice via ElevenLabs+Twilio (implemented); browser/text chat: none; SMS/email: none. Conversation state lives in ElevenLabs conversations (IDs recorded by `run-call.ts`) and locally as transcript turns + drafts + outcomes. Inbound flow: persona agent assigned to the inbound number answers (when configured); currently a human answers. Transcripts: mid-call via tool payload `turn_text` (creates provenance-eligible turns); post-call full transcription via HMAC-verified webhook, merged into the store. Real vs modeled: **real calls have been performed by the buyer agent** (evidence: voicemail-decline conversation `conv_5801…`, 118 s, structured DECLINED close; earlier human-answered quote test) — but the **complete 3-persona + negotiation voice run has not been captured**; the persisted golden run is text-mode. Failure handling implemented: voicemail → DECLINED close without leaking negotiation details; tool error fallback phrase; dropped-call → DROPPED; webhook signature rejection.

## 15. Benchmarking, evaluation, and testing

- **Automated tests:** `policy.test.ts` + `server.test.ts` (Vitest). Direct count of `it(` blocks: 2 + 5 = 7 test cases in current sources. Prior session reports cited "15/15 passing" (likely including since-consolidated variations); that figure was **not re-verifiable** in the documentation environment because Vitest's rollup native binary does not run on the inspection sandbox (macOS-installed `node_modules` on a Linux mount). **Backend `tsc --noEmit`: re-run during documentation — PASS (exit 0)** on the local working tree.
- **Behaviors covered by tests (from source):** empty-facts leverage DENY; policy invariants (UNKNOWN totals, mismatch refusal); server endpoint auth (tool secret, webhook signature) and read endpoints.
- **Runtime validation:** textloop's strict GATE is itself an executable evaluation (structured outcomes, minted facts, cheaper negotiated version, provenance completeness, honesty check) — last persisted run passed (evidence: `.data/current-run.json` complete state).
- **Frontend:** prior reports: production build passing; lint zero errors / six warnings. **Not re-run here** (bun dependencies not installed in the inspection environment). No CI configuration exists in the repository.
- **Benchmarks:** no latency/cost/success-rate benchmark harness exists in code. Price benchmarks and market statistics appear in research documents as sourced claims, not as executable evaluation.

## 16. Research and challenge materials

`research/` contains: the official ElevenLabs "Negotiator" challenge brief (PDF, duplicated at root of `research/challenges/` with five other challenge PDFs — vertical selection artifacts); `negotiator-idea-consolidation.md` (strategy, compliance checklist, vertical scoring); `windshield-vertical-deep-dive.md` (auto-glass industry case: market size, ADAS fee data, business models); `junk-removal-deep-dive-and-comparison.md` (fallback vertical + head-to-head scoring); `catering-deep-dive-final-verdict-and-pathway.md` (three-way verdict: glass 88.6 / junk 77.0 / catering 48.6; phased pathway); `negotiator-build-ready-architecture.md` (the detailed reference architecture that the implemented system selectively realizes). Influence on code is direct and traceable: fee taxonomy → `FeeCategory` enum; persona design + private cost models → `persona.*.yaml`; honesty/leverage design → `policy.ts`; playbook → `negotiation-playbook.yaml`; phased build order → git history. Not implemented from these documents: document/photo intake, voice intake interview, provider discovery, multi-vertical config, evidence audio clips, Postgres/Redis/S3 architecture, approval workflows. `STARTER_KIT.md` is the historical starter-kit README whose `packages/` layout was superseded by the flat root layout.

## 17. Environment, installation, and execution

Backend (root): Node runtime via `tsx`; installed with npm or pnpm (`package-lock.json` and `pnpm-lock.yaml` both present; `pnpm-workspace.yaml` defines the workspace). Commands (from `package.json`): `npm install`; `npm start` | `npm run textloop` (text loop; needs `OPENAI_API_KEY`); `npm run server` (Fastify on port 3000); `npm run provision` (needs `ELEVENLABS_API_KEY`, `PUBLIC_BASE_URL`, `TOOL_SHARED_SECRET`); `npm run call -- --persona <id> [--phase NEGOTIATION] [--to +E164]`; `npm run call:all`; `npm test`; `npm run typecheck`. Environment variables: the 12 names in `.env.example` (§12 table). Voice path additionally requires a live tunnel matching `PUBLIC_BASE_URL` and the ElevenLabs webhook configured to `<PUBLIC_BASE_URL>/webhooks/elevenlabs`.
Frontend (`auto-deal-navigator/`): bun (per lockfile) — `bun install`; `bun run dev` (Vite dev server); `bun run build`; `bun run lint`; `bun run format`; optional `VITE_RUNS_API_URL` to point at the backend. No deployment configuration exists for either side.

## 18. Current operational status

| Subsystem | Status | Works now | Partial / mocked / disconnected | Evidence |
|---|---|---|---|---|
| Backend engine (policy/playbook/tools/store) | Implemented and validated | Full text loop with gate | — | `.data/current-run.json`; tests |
| Text loop | Implemented and validated | Complete run, negotiation $780→$680 | Fixture-quality depends on OPENAI key presence | store contents |
| Voice calling | Implemented, partially runtime-validated | Provisioned agents; real outbound calls; voicemail handled structurally | Persona line = human phone (empty `PERSONA_PHONE_NUMBER_ID`); no captured full voice run | `agents.json`; `.env`; conv `conv_5801…` |
| Server/API | Implemented and validated | 4 endpoints, auth, HMAC, CORS | Unauthenticated read exposes full VIN | `server.ts`, `server.test.ts` |
| Frontend UI | Implemented; build previously validated | 5 screens, complete demo narrative on mock data | **Not connected in practice** — placeholder URL + contract mismatch; silent fallback | §6–§7 |
| FE↔BE connection | Connected with limitations | Endpoint reachable, CORS open, poller runs | `jobSpec` missing + shape mismatches → UI never leaves mock | §7 table |
| Run storage | Implemented | Atomic JSON persistence | Single run only; in-file, no DB | `store.ts` |
| Negotiation workflow | Implemented and validated (text) | Verified-leverage, triggers, counteroffer versioning | Voice-mode negotiation not yet captured | store; `run-call.ts` |
| Policy engine / ranking | Implemented and validated | Deny-by-default; deterministic ranking | Ranking shape ≠ frontend's | `policy.ts` |
| Messaging (SMS/chat) | Not present | — | — | — |
| MCP | Not present | — | Research mentions only | §13 |
| Provider discovery / doc intake / voice intake | Not present (research only) | — | — | §9, §16 |
| Auth (product-level) | Not present | Tool/webhook secrets only | No user auth on reads | `server.ts` |
| Testing | Implemented; partially re-validated | tsc PASS (re-run); 7 `it()` cases in source | Vitest/frontend build not re-runnable in inspection env | §15 |
| Deployment | Not present | Local + tunnel only | — | repo-wide |
| Observability | Partial | Console logs; server-timing header; timeline events | No structured logging/metrics | `server.ts`, `playbook.ts` |
| Auditability | Implemented | Provenance-mandatory numbers; policy decision log; immutable offer versions | Audio-clip anchors absent (turn-level only) | `domain.ts`, `tools.ts` |

## 19. Known factual limitations of the current implementation

- Frontend default API URL is the placeholder `https://your-ngrok-url.ngrok.app/runs/current`; live data additionally blocked by the missing `jobSpec` field and shape mismatches (§7); fallback to mock is silent with no UI indicator of data source.
- `PERSONA_PHONE_NUMBER_ID` is empty: persona agents cannot answer a phone line; voice runs operate in human-roleplay mode.
- Local `main` and `origin/main` are divergent (ahead 1 / behind 13); remote lacks the voice-tuning commit (Bill voice, temp 0.45, timeout 7 s, checklist feedback, prompt reminders).
- `GET /runs/current` is unauthenticated and returns the full unmasked VIN and complete transcripts.
- Single-run store; re-running overwrites the golden run unless the JSON file is copied aside.
- The persisted golden run is text-mode; no full voice-mode run is captured in the store.
- The Twilio account is on trial (trial announcement audible on calls; only one number imported).
- Intake (voice interview, document/photo), provider discovery, multi-vertical config switching, and audio-clip evidence exist in research documents but not in code.
- `research/challenges/` duplicates the Negotiator brief PDF; `STARTER_KIT.md` describes a superseded layout.
- Development on later commits bypassed the PR-only rule in `AGENTS.md` (direct pushes to `main`).

## 20. Complete implementation inventory

| Capability | Files | Type | Runtime status | Evidence |
|---|---|---|---|---|
| Canonical job spec + hash | `config.ts`, `policy.ts` | Deterministic code | Active | spec hash in store |
| Zod domain contract | `domain.ts` | Schemas | Active | imports repo-wide |
| 8 agent tools + provenance | `tools.ts` | Deterministic code | Active, exercised live | store provenance (25 anchors) |
| Honesty/leverage policy | `policy.ts` | Deterministic code | Active, tested | `policy.test.ts`; ALLOW/DENY in store |
| Negotiation playbook | `negotiation-playbook.yaml`, `playbook.ts` | Runtime config + code | Active | `[TACTIC]` timeline events |
| 3 counterparty personas | `persona.*.yaml`, `prompts.ts` | Runtime config + prompts | Active (text); voice-side agents provisioned | store quotes per persona |
| Buyer agent prompt (phased) | `prompts.ts` | Prompt-driven | Active | per-call override in `run-call.ts` |
| Text closed loop + gate | `textloop.ts` | Code + LLM | Validated end-to-end | `.data/current-run.json` |
| Fastify tool/webhook/read server | `server.ts` | Code | Active, tested | `server.test.ts` |
| ElevenLabs provisioning (4 agents) | `scripts/provision-agents.ts`, `scripts/elevenlabs-api.ts` | Code → external | Executed | `agents.json` |
| Outbound voice call runner | `scripts/run-call.ts` | Code → external | Executed (quote phase, human counterpart, voicemail case) | conversation IDs in session record |
| Run persistence | `store.ts`, `.data/` | Code | Active | atomic writes observed |
| Frontend dashboard (5 screens) | `auto-deal-navigator/src/**` | React app | Builds; renders mock | `use-runs-data.ts`, `mock-data.ts` |
| FE data hook w/ poll + fallback | `use-runs-data.ts` | Code | Active (mock-serving) | §7 |
| Tests | `policy.test.ts`, `server.test.ts` | Vitest | Present; last local report passing | §15 |
| Research corpus | `research/**`, `STARTER_KIT.md` | Documents | Non-executable | §16 |
| Coding-agent governance | `AGENTS.md`, `CLAUDE.md` | Process docs | Non-runtime | §10 |

## 21. Evidence appendix

**Key paths:** `domain.ts`, `policy.ts`, `playbook.ts`, `prompts.ts`, `tools.ts`, `store.ts`, `server.ts`, `textloop.ts`, `config.ts`, `scripts/{elevenlabs-api,provision-agents,run-call}.ts`, `persona.*.yaml`, `negotiation-playbook.yaml`, `auto-deal-navigator/src/hooks/use-runs-data.ts`, `auto-deal-navigator/src/lib/mock-data.ts`, `auto-deal-navigator/src/routes/*.tsx`, `.env.example`, `.data/current-run.json`, `agents.json`.
**Key exported symbols:** `freezeSpecCore`, `mintCompetitorOfferFact`, `requestLeverage`, `computeKnownTotal`, `applyRedFlags`, `rankQuotes`, `planNegotiation`, `logTimeline`, `buyerPrompt`, `personaPrompt`, `BUYER_FIRST_MESSAGE`, `dispatchTool`, `TOOL_NAMES`, `snapshot`, `mutate`, `loadStore`, `useRunsData`.
**Routes:** `POST /tools/:toolName`, `POST /webhooks/elevenlabs`, `GET /runs/current`, `GET /health`; frontend `/`, `/calls`, `/compare`, `/negotiation`, `/recommendation`.
**Package scripts:** backend `start|textloop|server|provision|call|call:all|test|typecheck`; frontend `dev|build|build:dev|preview|lint|format`.
**Environment variables:** `OPENAI_API_KEY`, `OPENAI_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_PHONE_NUMBER_ID`, `PERSONA_PHONE_NUMBER_ID`, `PERSONA_TO_NUMBER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TOOL_SHARED_SECRET`, `PUBLIC_BASE_URL`, `ELEVENLABS_WEBHOOK_SECRET`, `NGROK_AUTHTOKEN`, frontend `VITE_RUNS_API_URL`, test `RUN_STORE_PATH`.
**Verification commands run during documentation:** `git ls-tree -r origin/main --name-only`; `git log --oneline`; `git status --short --branch` (ahead 1 / behind 13); `git diff HEAD origin/main --stat`; `git show origin/main:<file>` for `store.ts`, `prompts.ts` region, `provision-agents.ts` (confirming remote Rachel/temp 0/timeout 12), `use-runs-data.ts`, `mock-data.ts`, `package.json`, `.env.example`, `AGENTS.md`, `CLAUDE.md`, `STARTER_KIT.md`; `npx tsc --noEmit` → **PASS (exit 0)**; JSON inspection of `.data/current-run.json` (61 turns / 25 provenance / 4 outcomes / 4 quotes / 3 facts / 1 ALLOW / ranking 6); `npx vitest run` → not executable in inspection sandbox (platform-specific rollup binary), noted rather than substituted.
**Key commits:** `0659b88` text loop · `8be5e2c` playbook · `16a7525` VIN (PR #6) · `c2bacaa` voice transport (PR #7) · `1670b51` CORS (PR #8) · `e1ce37f` M2 config merge · `8182510` voice tuning (local-only at time of writing) · `7dfc276` frontend merge + format (remote HEAD).
