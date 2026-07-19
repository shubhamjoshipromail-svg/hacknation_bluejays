import { cn } from "@/lib/utils";
import { Mic, FileText, ShieldCheck } from "lucide-react";
import type { ProvenanceSource } from "@/lib/mock-data";

const map = {
  VOICE: { label: "VOICE", icon: Mic, className: "text-info border-info/30 bg-info/10" },
  DOCUMENT: {
    label: "DOCUMENT",
    icon: FileText,
    className: "text-warning border-warning/30 bg-warning/10",
  },
  NHTSA: {
    label: "NHTSA",
    icon: ShieldCheck,
    className: "text-primary border-primary/30 bg-primary/10",
  },
} as const;

export function SourceTag({ source, className }: { source: ProvenanceSource; className?: string }) {
  const cfg = map[source];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.08em] mono",
        cfg.className,
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

export function HashChip({ hash, label = "SPEC" }: { hash: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 mono text-[10px] text-primary">
      <span className="h-1 w-1 rounded-full bg-primary shadow-[0_0_6px] shadow-primary" />
      <span className="text-primary/70">SHA-256 · {label}</span>
      <span>{hash}</span>
    </span>
  );
}
