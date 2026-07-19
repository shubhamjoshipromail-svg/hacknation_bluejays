import { AlertTriangle } from "lucide-react";
import { JOB_SPEC } from "@/lib/mock-data";

export function DemoBanner() {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-[11px] font-medium tracking-wide text-warning">
      <AlertTriangle className="h-3 w-3" />
      <span className="uppercase">Simulated provider market — demo mode</span>
      <span className="mx-2 h-3 w-px bg-warning/30" />
      <span className="mono text-warning/80">
        run started 07/19 · spec {JOB_SPEC.hash}
      </span>
    </div>
  );
}
