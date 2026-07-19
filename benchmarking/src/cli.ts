import fs from "node:fs/promises";
import { runBenchmarkPipeline } from "./pipeline.js";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Usage: pnpm benchmark <request.json> [--offline]");
const input = JSON.parse(await fs.readFile(inputPath, "utf8"));
let offlineBodies: Record<string, string> | undefined;
if (process.argv.includes("--offline")) {
  offlineBodies = {
    "aaa-windshield-costs": await fs.readFile(new URL("../fixtures/aaa-costs.html", import.meta.url), "utf8"),
    "aaa-adas-study": await fs.readFile(new URL("../fixtures/aaa-adas.txt", import.meta.url), "utf8")
    ,"vehicle-pricing": await fs.readFile(new URL("../fixtures/grand-caravan.html", import.meta.url), "utf8")
  };
}
const result = await runBenchmarkPipeline(input, { offlineBodies, skipProviders: process.argv.includes("--offline") });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
