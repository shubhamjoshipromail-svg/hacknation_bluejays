import { useEffect, useState } from "react";
import {
  JOB_SPEC,
  QUOTES,
  POLICY_DECISIONS,
  RANKING,
  type JobSpec,
  type Quote,
  type PolicyDecision,
  type RankingEntry,
} from "@/lib/mock-data";

export interface RunsData {
  jobSpec: JobSpec;
  quotes: Quote[];
  policyDecisions: PolicyDecision[];
  ranking: RankingEntry[];
}

const MOCK: RunsData = {
  jobSpec: JOB_SPEC,
  quotes: QUOTES,
  policyDecisions: POLICY_DECISIONS,
  ranking: RANKING,
};

const RUNS_URL =
  (import.meta.env.VITE_RUNS_API_URL as string | undefined) ??
  "https://your-ngrok-url.ngrok.app/runs/current";

const POLL_MS = 3000;

function isNonEmpty(d: Partial<RunsData> | null | undefined): d is RunsData {
  if (!d) return false;
  return (
    !!d.jobSpec &&
    Array.isArray(d.quotes) &&
    d.quotes.length > 0 &&
    Array.isArray(d.policyDecisions) &&
    Array.isArray(d.ranking)
  );
}

export function useRunsData(): RunsData {
  const [data, setData] = useState<RunsData>(MOCK);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(RUNS_URL, {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as Partial<RunsData>;
        if (cancelled) return;
        if (isNonEmpty(json)) setData(json);
      } catch {
        // silent fallback — keep last good (or mock) data
      }
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return data;
}
