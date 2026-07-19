import { AlertTriangle } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-[11px] font-medium tracking-wide text-warning">
      <AlertTriangle className="h-3 w-3" />
      <span className="uppercase">Human approval required for every consequential action</span>
      <span className="mx-2 h-3 w-px bg-warning/30" />
      <span className="mono text-warning/80">Benchmarks show their provenance</span>
    </div>
  );
}
