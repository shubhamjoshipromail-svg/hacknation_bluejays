import { AlertTriangle } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-primary/15 bg-[#fff5f7] px-4 py-2 text-center text-[10px] font-semibold tracking-wide text-primary sm:text-[11px]">
      <AlertTriangle className="h-3 w-3" />
      <span className="uppercase">Sandbox mode · configured number is the provider</span>
      <span className="mx-2 hidden h-3 w-px bg-primary/25 sm:block" />
      <span className="mono text-primary/75">No booking or commitment is authorized</span>
    </div>
  );
}
