# Evaluation Foundation (Milestone 1)

This is the first milestone of the evaluation-driven improvement loop: a scenario suite, a
test runner, and a deterministic evaluator that exercise the negotiator's real backend
conversation brain (`call-intelligence.ts`, `tools.ts`, `policy.ts`) through `dispatchTool`,
the same stable interface the ElevenLabs voice agent uses in production calls.

```bash
npm run eval
```

Each run resets an isolated store (`RUN_STORE_PATH=evaluation/.data/eval-run.json`), replays
every training scenario with a simulated shop, evaluates the artifacts with code-based checks,
runs the whole suite twice to verify determinism, and writes a machine-readable report to
`evaluation/reports/`.

## What is and is not simulated

- The **simulated shop** speaks only from the scenario contract. `privateTruth` is visible to
  the shop and the evaluator, never to the negotiator side.
- The **adaptive driver** mirrors the intake prompt's documented policy: call `get_call_state`,
  pursue `recommendedGoals`, record every explicit fact, close only when `canClose`. It stands in
  for the LLM's conversational layer; the state engine, fact store, draft quote, reconciliation,
  leverage policy, and close guardrails under test are the real production code.
- The **naive driver** is a seeded failure (asks only for a headline price, then tries to close)
  used to prove the evaluator catches bad behavior.

What this layer cannot test: the LLM's own utterance understanding and fact extraction inside the
hosted ElevenLabs agent. That is Milestone 5 territory (agent simulation / voice tests) and needs
either an LLM API key for a local text loop or the ElevenLabs conversation-simulation API.

## Layout

```
evaluation/
  harness.ts      simulated shop + agent drivers over dispatchTool
  checks.ts       deterministic evaluator (source of truth for scoring)
  run.ts          runner, reproducibility check, report writer
  scenarios/
    training/     visible scenarios (5 initial, per plan section 14)
  reports/        run artifacts (committed baseline + gitignored later runs)
```

## Known baseline failures (by design, candidates for Phase B diagnosis)

- `SCHED-04` fails `FACT-AVAILABILITY` and `SCHEDULE-COMPATIBILITY`: the brain's `canClose`
  does not consider the customer's schedule urgency, so the agent can close a quote without
  ever asking for an appointment window. This is the first reproducible failure the
  improvement loop should diagnose and patch.
