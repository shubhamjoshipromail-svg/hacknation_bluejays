import { AlertTriangle } from "lucide-react";
import { JOB_SPEC } from "@/lib/mock-data";

export function DemoBanner() {
  return (
    <div className="relative z-50 flex min-h-7 items-center justify-center gap-2 border-b border-warning/20 bg-warning/[0.07] px-3 py-1.5 text-[10px] font-medium tracking-wide text-warning backdrop-blur-md">
      <AlertTriangle className="h-3 w-3" />
      <span className="uppercase tracking-[0.13em]">
        Simulated provider market <span className="hidden sm:inline">— demo mode</span>
      </span>
      <span className="mx-1 hidden h-3 w-px bg-warning/30 sm:block" />
      <span className="mono hidden text-warning/75 sm:inline">
        run started 07/19 · spec {JOB_SPEC.hash}
      </span>
    </div>
  );
}
