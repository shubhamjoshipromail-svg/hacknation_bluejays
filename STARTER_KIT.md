# Negotiator Starter Kit (M1 — Domain & Policy Lead)

Drop-in starting point for the critical path: schemas → policy engine → text loop.
Everything here maps 1:1 to `negotiator-team-build-plan.md` §3 (integration contracts) and the architecture doc §6–§10.

## Files

| File | What it is | Status |
|---|---|---|
| `domain.ts` | Zod schemas — THE integration contract all 4 members import | ~90% complete, extend as needed |
| `policy.ts` | Policy engine — verified-leverage minting, deny-by-default, concession ladder | Core logic complete, wire to DB |
| `persona.premium_chain.yaml` | First counterparty persona with private cost model | Template for M4's other two |
| `textloop.ts` | Phase-1 text-only closed-loop runner skeleton | Skeleton with TODOs |

## Setup (do this first, ~20 min)

```bash
mkdir negotiator && cd negotiator
pnpm init
pnpm add zod yaml openai        # or anthropic sdk — whatever LLM you use for text-mode
pnpm add -D typescript tsx @types/node vitest
npx tsc --init --strict
mkdir -p packages/domain packages/policy packages/simulation packages/verticals/auto-glass
# copy domain.ts → packages/domain/index.ts
# copy policy.ts → packages/policy/index.ts
# copy persona.premium_chain.yaml → packages/simulation/personas/
```

Postgres can wait until the text loop works — start with in-memory stores (see `textloop.ts`).
That's a deliberate simplification: prove the loop, then persist.

## Your first-day order of operations

1. **Hour 1:** team sync — walk everyone through `domain.ts`. Freeze it. (Changes after this need your approval.)
2. **Hour 2–3:** stub the 8 tool endpoints (just functions for now — HTTP comes later) returning fixture data → unblocks M2 immediately.
3. **Hour 3–6:** make `textloop.ts` real: wire an LLM for buyer + personas, real tool implementations writing to in-memory stores.
4. **Hour 6–7:** normalization + red flags + ranking (all deterministic — no LLM).
5. **Gate check:** run `npx tsx textloop.ts` → 3 structured outcomes, 1 policy-authorized negotiation, fake-leverage DENIED, report with provenance. Then celebrate, then Postgres.

## The two tests that matter most (write them early)

```ts
// 1. The honesty test — the demo's "try to make it lie" moment
expect(requestLeverage({ desiredClaim: "competitor offered $500" /* no such verified fact */ }))
  .toMatchObject({ decision: "DENY" });

// 2. UNKNOWN is never zero
expect(computeKnownTotal(quoteWithUnknownCalibration).isAllIn).toBe(false);
```
