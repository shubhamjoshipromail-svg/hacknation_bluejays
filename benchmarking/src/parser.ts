import { createHash } from "node:crypto";
import type { BenchmarkSignal } from "./contracts.js";
import type { SourceDefinition } from "./source-registry.js";

const dollars = (raw: string) => Math.round(Number(raw.replaceAll(",", "")) * 100);
const textOnly = (body: string) => body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export function parseSource(source: SourceDefinition, body: string, retrievedAt = new Date().toISOString()): BenchmarkSignal[] {
  const text = textOnly(body);
  return source.parser.flatMap(rule => {
    const match = text.match(rule.pattern);
    if (!match) return [];
    const low = dollars(match[1]);
    const high = match[2] ? dollars(match[2]) : low;
    const typicalMatch = rule.typicalPattern ? text.match(rule.typicalPattern) : null;
    const typical = typicalMatch ? dollars(typicalMatch[1]) : Math.round((low + high) / 2);
    const excerpt = match[0].slice(0, 280);
    const signalId = createHash("sha256").update(`${source.id}:${rule.kind}:${excerpt}`).digest("hex").slice(0, 16);
    return [{ signalId, kind: rule.kind, label: rule.label, lowMinor: low, typicalMinor: typical, highMinor: high, currency: "USD" as const, geography: "US_NATIONAL" as const, conditions: rule.conditions, evidence: { sourceId: source.id, publisher: source.publisher, url: source.url, retrievedAt, publishedOrUpdatedAt: null, strength: source.strength, excerpt } }];
  });
}
