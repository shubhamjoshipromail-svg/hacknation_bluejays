import { mutate } from "./store.js";

export function purgeExpiredCallEvidence(now = new Date(), retentionDays = 30) {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  return mutate((state) => {
    let purgedCalls = 0;
    for (const negotiation of Object.values(state.negotiations)) {
      for (const call of negotiation.calls) {
        if (!call.endedAt || call.retentionPurgedAt || new Date(call.endedAt).getTime() >= cutoff) continue;
        const turnIds = new Set(call.transcript.map((turn) => turn.turnId));
        call.transcript = [];
        call.retentionPurgedAt = now.toISOString();
        for (const evidence of negotiation.evidence)
          if (turnIds.has(evidence.turnId)) evidence.transcriptExcerpt = "[purged after retention period]";
        for (const turnId of turnIds) delete state.transcriptTurns[turnId];
        purgedCalls++;
      }
    }
    return { purgedCalls, retentionDays };
  });
}
