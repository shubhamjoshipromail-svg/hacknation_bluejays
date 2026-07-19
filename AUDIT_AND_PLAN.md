# The Negotiator - Audit and Implementation Plan

## Current system

The repository is a strong auto-glass negotiation engine wrapped in an incomplete product. The flat TypeScript backend can run a deterministic three-persona text demo, provision ElevenLabs/Twilio voice agents, ingest tool calls and transcripts, verify competitor leverage, itemize quotes, flag risks, and rank offers. Runtime state is one JSON file. The React dashboard exists, but its wire contract differs from the backend and it silently displays bundled mock data.

## What works and should be retained

- `domain.ts`, `policy.ts`, and the money-in-cents convention provide useful deterministic guardrails.
- Quote line-item provenance and transcript anchoring make claims traceable.
- Verified leverage is deny-by-default; the model cannot invent competing bids.
- Structured call outcomes, webhook verification, tool authentication, and atomic JSON persistence work.
- ElevenLabs/Twilio provisioning and calling are isolated in three small scripts.
- Three distinct counterparty personas and the text golden path are useful demo/evaluation fixtures.
- The frontend already has useful visual primitives for quote, transcript, risk, and ranking display.

## Broken or incomplete

- There is no user intake. `config.ts` contains one real VIN and a job spec confirmed at module load.
- Voice intake and document intake - both required by the challenge - are absent.
- `/runs/current` does not match the frontend's `RunsData`; the UI therefore never leaves mock data.
- Mock fallback is silent, so judges cannot tell whether the backend is connected.
- The store has one global run, no negotiation identity, no explicit lifecycle, no durable approvals, no offers/history abstraction, and no follow-up loop.
- Outbound calls do not require a recorded user approval.
- Red flags are applied in the text runner, not consistently when voice quotes are finalized.
- The ranking stores `unknown`, mixes initial and negotiated versions, and has no stable recommendation contract.
- `textloop.ts` combines fixture simulation, normalization, negotiation, reporting, and gating.
- Model calls have no shared timeout/structured-output gateway; report prose is the only direct OpenAI call in the canonical demo.
- The public read endpoint exposes the full VIN.
- Missing critical tests: creation/intake, lifecycle transitions, approvals, follow-up idempotency, recommendation decisions, frontend wire compatibility, and failure fallback.
- No recording URL is retained, and no complete three-call voice golden run is evidenced locally.

## Simplification audit

### Keep

- One Fastify API, Zod validation, one JSON persistence layer, deterministic policy functions.
- Eight ElevenLabs call tools, three persona configs, one negotiation playbook, one voice adapter.
- One frontend application.

### Remove from the primary product path

- Hard-coded confirmed demo spec as the source of truth.
- Silent frontend mock fallback and duplicated frontend-only contract types.
- Direct state mutation from runners and `ranking: unknown`.
- Multiple disconnected pages that imply live behavior without live data.

Historical research and the text fixture remain available, but are clearly labeled as demo/evaluation support.

### Rewrite

- Replace the global run snapshot with a canonical `Negotiation` record and explicit state machine.
- Put intake, approval, quote ingestion, recommendation, follow-up, and close operations in one service.
- Make `/api/negotiations` the stable API and keep `/runs/current` only as a compatibility view.
- Make the frontend one guided workspace driven exclusively by the canonical API, with an explicit offline/error state.
- Centralize red-flag application, offer comparison, recommendation rules, and event creation.

## Missing HackNation requirements

- Voice interview intake: adapter/scaffold can be provisioned, but no completed live intake is stored.
- Document intake into the same schema: missing.
- User confirmation before calls: missing.
- Live three-style voice demo: infrastructure exists; a captured golden run is still operational work.
- Recordings in final report: recording metadata is missing.
- Programmatic provider discovery: only described in research; not implemented. It is not a strict success criterion, so it will remain a documented optional adapter.
- Vertical-specific taxonomy is partly code. The working demo will stay auto glass; a small vertical config will hold benchmark/risk/display parameters.

## Canonical workflow

`intake -> awaiting_user_approval -> strategy_ready -> calls_ready -> call_in_progress -> offer_received -> recommendation_ready -> follow_up_required -> accepted | walked_away | closed`

1. Create a draft with objective, current situation, priorities, constraints, target, walk-away point, deadline, and supporting context.
2. Add interview answers and/or a text document; both update the same intake/spec object with source labels.
3. Show estimated benchmark provenance, red flags, and a compact strategy.
4. User confirms the spec and separately approves outbound calls.
5. Calls create transcript-backed, itemized offers and structured outcomes.
6. Deterministic comparison evaluates the latest offer for each provider against the benchmark, target, walk-away point, priorities, previous concessions, and risks.
7. The app returns `ACCEPT`, `COUNTER`, `CLARIFY`, `DELAY`, `ESCALATE`, or `WALK_AWAY`; only the user can approve a consequential next step.
8. Idempotent follow-ups preserve promises, deadlines, open questions, and status until a terminal state.

## Backend architecture and data model

- `server.ts`: transport, authentication, validation, and centralized errors.
- `negotiation-service.ts`: the one canonical workflow and state transitions.
- `store.ts`: atomic JSON repository containing negotiations plus legacy voice-call data during migration.
- `policy.ts`: deterministic totals, risks, verified leverage, ranking, and recommendation thresholds.
- `model-gateway.ts` (only when needed): one timeout-bounded structured-output boundary; deterministic fallbacks remain authoritative.
- Existing ElevenLabs scripts: external integration adapter.

Minimal durable entities are embedded in one negotiation aggregate: intake/spec, benchmark, strategy, calls/transcripts, offers, red flags, recommendation, approvals, follow-ups, and append-only events. This avoids unnecessary tables while retaining a complete explanation trail.

## Frontend changes

- Replace mock-first polling with a typed API client and visible connection/error state.
- Use one guided page with intake, strategy approval, call approval, live/history panels, offer comparison, recommendation, follow-up, and final outcome.
- Never display fake provider data as live. A deliberate "Load demo" action may create a labeled simulated run.
- Mask VIN/sensitive values in all unauthenticated display responses.

## External services

- ElevenLabs + Twilio: required for challenge voice calls; keep behind existing adapter, with explicit approval and timeouts.
- OpenAI: optional for language polish/extraction; deterministic workflow works without it.
- Local JSON store: sufficient for the hackathon demo; replace with a database only after the demo.
- Provider discovery/market APIs: not required for the canonical demo and therefore not added as another failure point.

## Major risks

- A full live demo still depends on valid ElevenLabs/Twilio credentials, public webhook reachability, and three completed calls.
- Text-document parsing without a model supports a deliberately narrow format and must label uncertain fields.
- Existing voice tools use a legacy global draft store; migration must preserve them while linking calls to negotiations.
- The repository contains a real VIN; API views must mask it and new demo data should use non-sensitive examples.

## Implementation sequence

1. Add canonical schemas, state machine, service, events, approvals, and persistence migration.
2. Add validated REST endpoints, compatibility output, redaction, and centralized errors.
3. Integrate existing call tools with negotiation IDs and enforce call approval.
4. Replace frontend mock contract with the canonical API and one guided workspace.
5. Add integration tests for lifecycle, policy, failures, idempotency, and frontend contract.
6. Run backend typecheck/tests, frontend build/lint, and a deterministic golden demo.
7. Update README, environment documentation, compliance checklist, and demo script.
