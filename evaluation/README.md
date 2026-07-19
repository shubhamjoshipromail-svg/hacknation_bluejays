# Evaluation Foundation

Run the loop with:

```bash
npm run eval
```

The canonical documentation - scenario catalog, levels, check reference, change log, and the
procedure for when something breaks - lives in [TEST_LOOP_README.md](../TEST_LOOP_README.md)
at the repository root.

Quick orientation: `harness.ts` holds the simulated shop and the drivers, `checks.ts` is the
deterministic evaluator, `run.ts` runs every scenario twice (verifying determinism) and writes
reports to `reports/`. Scenarios are self-contained JSON files in `scenarios/training/`; the
negotiator side never sees a scenario's `privateTruth`.
