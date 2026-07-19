import { createFileRoute } from "@tanstack/react-router";
import { SourceTag, HashChip } from "@/components/ui-bits";
import { CheckCircle2, ShieldCheck, Copy, Clock } from "lucide-react";
import { useRunsData } from "@/hooks/use-runs-data";

export const Route = createFileRoute("/")({
  component: JobSpecPage,
});

function Field({
  label,
  value,
  source,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  source: React.ComponentProps<typeof SourceTag>["source"];
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border py-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        <SourceTag source={source} />
      </div>
      <div className={`text-sm text-foreground ${mono ? "mono" : ""}`}>{value}</div>
    </div>
  );
}

function JobSpecPage() {
  const { jobSpec: JOB_SPEC } = useRunsData();
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:px-10 md:py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <span className="h-1 w-6 bg-primary" /> Step 01 · Job Spec
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Confirmed job specification</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          A single hashed source of truth. Every provider call, quote line, and negotiation tactic
          is anchored to this spec.
        </p>
      </header>

      <div className="panel overflow-hidden">
        {/* Status header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-panel-2/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 ring-1 ring-success/40">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-success">CONFIRMED</span>
                <span className="text-[11px] text-muted-foreground">
                  · locked 07/19 · 14:02 EST
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                All fields verified against source provenance
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HashChip hash={JOB_SPEC.hash} />
            <button
              className="inline-flex items-center gap-1 rounded-md border border-border bg-panel px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              type="button"
            >
              <Copy className="h-3 w-3" /> copy
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="p-6 md:border-r border-border">
            <Field
              label="Vehicle"
              source={JOB_SPEC.vehicle.source}
              value={`${JOB_SPEC.vehicle.year} ${JOB_SPEC.vehicle.make} ${JOB_SPEC.vehicle.model}`}
            />
            <Field label="VIN" source={JOB_SPEC.vin.source} mono value={JOB_SPEC.vin.masked} />
            <Field label="Service" source={JOB_SPEC.service.source} value={JOB_SPEC.service.type} />
            <Field label="Payment" source={JOB_SPEC.payment.source} value={JOB_SPEC.payment.type} />
            <Field
              label="Location"
              source={JOB_SPEC.location.source}
              value={`ZIP ${JOB_SPEC.location.zip}`}
            />
          </div>

          <div className="p-6">
            <div className="border-b border-border pb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  ADAS
                </span>
                <SourceTag source="NHTSA" />
              </div>
              <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <div className="text-sm">
                  <span className="font-semibold text-primary">ADAS front camera: CONFIRMED</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    (NHTSA vehicle safety database)
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Calibration is required after windshield replacement for this VIN. Providers
                omitting calibration will be flagged.
              </p>
            </div>

            <div className="pt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Schedule windows
                </span>
                <SourceTag source={JOB_SPEC.schedule.source} />
              </div>
              <ul className="space-y-1.5">
                {JOB_SPEC.schedule.windows.map((w) => (
                  <li
                    key={w}
                    className="flex items-center gap-2 rounded-md border border-border bg-panel-2/60 px-3 py-2 text-sm"
                  >
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="mono">{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-border bg-panel/50 px-4 py-3 text-[11px] text-muted-foreground">
        <span className="mono text-primary">provenance:</span> every field on this spec carries a
        source tag. Downstream agents can only cite claims traceable to{" "}
        <span className="mono">VOICE</span>, <span className="mono">DOCUMENT</span>, or{" "}
        <span className="mono">NHTSA</span> evidence — no hallucinated facts cross the policy
        boundary.
      </div>
    </div>
  );
}
