import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Clock, PhoneCall, Search, ShieldCheck } from "lucide-react";
import { api, useRunsData } from "@/hooks/use-runs-data";
import type { SandboxIntakeRequest } from "../../../shared/contracts";

export const Route = createFileRoute("/")({ component: Workspace });
const money = (value: number | null | undefined) =>
  value == null
    ? "Awaiting quotes"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value / 100);
const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());

function IntakeForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget),
      vin = String(form.get("vin") ?? "")
        .trim()
        .toUpperCase();
    const payload: SandboxIntakeRequest = {
      vehicle: {
        year: Number(form.get("year")),
        make: String(form.get("make") ?? "").trim(),
        model: String(form.get("model") ?? "").trim(),
        vin: vin || null,
      },
      damage: {
        service: String(form.get("service")) as SandboxIntakeRequest["damage"]["service"],
        type: String(form.get("damageType")) as SandboxIntakeRequest["damage"]["type"],
        location: String(form.get("damageLocation")) as SandboxIntakeRequest["damage"]["location"],
        drivable: form.get("drivable") === "on",
      },
      features: form.getAll("features") as SandboxIntakeRequest["features"],
      postalCode: String(form.get("zip") ?? ""),
      insuranceInvolved: form.get("insurance") === "on",
      schedulePreference: String(form.get("schedule") ?? "").trim() || null,
    };
    try {
      await api("/api/runs", { method: "POST", body: JSON.stringify(payload) });
      await onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start the sandbox workflow");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:px-10 md:py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <span className="h-1 w-6 bg-primary" />
          Sandbox · guided workflow
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Find a windshield quote</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Tell us about the vehicle and damage once. Submission discovers the configured sandbox
          provider and starts the call automatically.
        </p>
      </header>
      <form onSubmit={submit} className="panel overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border bg-panel-2/60 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
            <Search className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Vehicle and damage</p>
            <p className="text-xs text-muted-foreground">
              Only quote-relevant details are required.
            </p>
          </div>
        </div>
        <div className="grid gap-5 p-6 md:grid-cols-2">
          <label className="text-sm">
            Year
            <input
              required
              name="year"
              type="number"
              min="1980"
              max="2100"
              defaultValue="2021"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5"
            />
          </label>
          <label className="text-sm">
            Make
            <input
              required
              name="make"
              defaultValue="Volkswagen"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5"
            />
          </label>
          <label className="text-sm">
            Model
            <input
              required
              name="model"
              defaultValue="Tiguan"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5"
            />
          </label>
          <label className="text-sm">
            VIN <span className="text-muted-foreground">(optional)</span>
            <input
              name="vin"
              minLength={17}
              maxLength={17}
              pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}"
              placeholder="Only used if the provider asks"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5 mono"
            />
          </label>
          <label className="text-sm">
            Service needed
            <select
              name="service"
              defaultValue="NOT_SURE"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5"
            >
              <option value="NOT_SURE">Not sure — ask the provider</option>
              <option value="REPAIR">Repair</option>
              <option value="REPLACEMENT">Replacement</option>
            </select>
          </label>
          <label className="text-sm">
            Damage type
            <select
              name="damageType"
              defaultValue="CRACK"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5"
            >
              <option value="CHIP">Chip</option>
              <option value="CRACK">Crack</option>
              <option value="SHATTERED">Shattered</option>
              <option value="OTHER">Other</option>
              <option value="NOT_SURE">Not sure</option>
            </select>
          </label>
          <label className="text-sm">
            Damage location
            <select
              name="damageLocation"
              defaultValue="CENTER"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5"
            >
              <option value="DRIVER_SIDE">Driver side</option>
              <option value="PASSENGER_SIDE">Passenger side</option>
              <option value="CENTER">Center</option>
              <option value="EDGE">Edge</option>
              <option value="MULTIPLE">Multiple areas</option>
              <option value="NOT_SURE">Not sure</option>
            </select>
          </label>
          <label className="text-sm">
            ZIP code
            <input
              required
              name="zip"
              inputMode="numeric"
              pattern="[0-9]{5}"
              defaultValue="28202"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5"
            />
          </label>
          <fieldset className="md:col-span-2">
            <legend className="text-sm">
              Known windshield features{" "}
              <span className="text-muted-foreground">(select what you know)</span>
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {[
                ["FRONT_CAMERA", "Front camera"],
                ["RAIN_SENSOR", "Rain sensor"],
                ["HEATED_GLASS", "Heated glass"],
                ["HUD", "Heads-up display"],
              ].map(([value, text]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 rounded-md border border-border bg-panel-2/40 px-3 py-2 text-sm"
                >
                  <input type="checkbox" name="features" value={value} />
                  {text}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="md:col-span-2 text-sm">
            Scheduling preference <span className="text-muted-foreground">(optional)</span>
            <input
              name="schedule"
              placeholder="Example: weekday afternoons; mobile service preferred"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5"
            />
          </label>
          <div className="md:col-span-2 flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="drivable" defaultChecked />
              Vehicle is drivable
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="insurance" />
              Insurance may be involved
            </label>
          </div>
          {error && (
            <div className="md:col-span-2 rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-panel-2/40 px-6 py-4">
          <p className="max-w-xl text-xs text-muted-foreground">
            Submitting authorizes quote and negotiation calls only. The agent cannot book, purchase,
            or accept an offer.
          </p>
          <button
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <PhoneCall className="h-4 w-4" />
            {busy ? "Starting workflow…" : "Find and call provider"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Workspace() {
  const data = useRunsData(),
    [showForm, setShowForm] = useState(false);
  if (!data.negotiation || showForm)
    return (
      <IntakeForm
        onCreated={async () => {
          await data.refresh();
          setShowForm(false);
        }}
      />
    );
  const n = data.negotiation,
    provider = n.providers[0],
    call = n.calls.at(-1),
    offer = n.offers.at(-1);
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <span className="h-1 w-6 bg-primary" />
            Sandbox · {label(n.state)}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {n.intake.vehicle.year} {n.intake.vehicle.make} {n.intake.vehicle.model}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {label(n.intake.damage.service)} · {label(n.intake.damage.type)} · ZIP{" "}
            {n.intake.postalCode}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md border border-border bg-panel px-3 py-2 text-xs hover:text-primary"
        >
          Start a new search
        </button>
      </header>
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Provider discovery</h2>
            {provider?.verified && <CheckCircle2 className="h-4 w-4 text-success" />}
          </div>
          {provider ? (
            <>
              <div className="mt-4 space-y-2">
                {n.providers.map((item, index) => (
                  <div key={item.providerId} className="rounded border border-border px-2 py-1.5">
                    <p className="text-sm font-semibold">
                      {index + 1}. {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.locationLabel}</p>
                  </div>
                ))}
              </div>
              <span className="mt-4 inline-flex rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-warning">
                Sandbox configured number
              </span>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Discovering the sandbox provider…</p>
          )}
        </section>
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Provider call</h2>
            {call?.status === "IN_PROGRESS" ? (
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-success" />
            ) : (
              <PhoneCall className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          {call ? (
            <>
              <p className="mt-4 text-lg font-semibold">{label(call.status)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {call.phase === "QUOTE_COLLECTION"
                  ? "Gathering an itemized quote"
                  : "Negotiating the verified quote"}
              </p>
              {call.intelligence && (
                <div className="mt-3 rounded border border-primary/25 bg-primary/5 p-2 text-xs">
                  <p className="font-semibold">
                    Conversation brain · {label(call.intelligence.completionStatus)}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {call.intelligence.facts.length} facts captured
                    {call.intelligence.criticalGaps.length
                      ? ` · next gaps: ${call.intelligence.criticalGaps.slice(0, 3).map(label).join(", ")}`
                      : " · critical quote facts resolved"}
                  </p>
                  {call.intelligence.contradictions.some((item) => !item.resolved) && (
                    <p className="mt-1 text-warning">A conflicting answer needs confirmation.</p>
                  )}
                </div>
              )}
              {call.reason && (
                <p className="mt-3 rounded border border-warning/30 bg-warning/5 p-2 text-xs">
                  {call.reason}
                </p>
              )}
              <Link to="/calls" className="mt-4 inline-block text-xs font-semibold text-primary">
                View call and transcript →
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">The call will start automatically.</p>
          )}
        </section>
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Quote benchmark</h2>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-4 text-xs uppercase tracking-wider text-warning">
            {n.benchmark.classification}
          </p>
          <p className="mt-2 text-xl">
            {money(n.benchmark.lowMinor)}–{money(n.benchmark.highMinor)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Typical {money(n.benchmark.typicalMinor)} · estimates remain labeled until comparable
            calls arrive.
          </p>
        </section>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-semibold">Quote and validation</h2>
          {offer ? (
            <div className="mt-4 rounded-md border border-border bg-panel-2/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{provider?.name ?? offer.providerId}</span>
                <span className="text-lg font-semibold text-primary">
                  {money(offer.totals.statedAllInMinor)}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {offer.lineItems.map((item) => (
                  <div
                    key={`${item.category}-${item.rawLabel}`}
                    className="flex justify-between text-xs"
                  >
                    <span>
                      {label(item.category)} · {item.status}
                    </span>
                    <span>{money(item.amountMinor)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-md border border-border bg-panel-2/40 p-4 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Waiting for the provider to confirm an itemized quote.
            </div>
          )}
          {n.redFlags.map((flag) => (
            <div
              key={`${flag.code}-${flag.detail}`}
              className="mt-3 flex gap-2 rounded border border-warning/40 bg-warning/5 p-3 text-xs"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <div>
                <b>{flag.code}</b>
                <p className="mt-1 text-muted-foreground">{flag.detail}</p>
              </div>
            </div>
          ))}
        </section>
        <section className="panel p-5">
          <h2 className="font-semibold">Recommendation</h2>
          {n.recommendation ? (
            <>
              <p className="mt-4 text-xl font-semibold text-primary">
                {label(n.recommendation.action)}
              </p>
              <p className="mt-2 text-sm">{n.recommendation.summary}</p>
              <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {n.recommendation.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              A transparent recommendation appears after the transcript and quote pass validation.
            </p>
          )}
          <div className="mt-5 rounded-md border border-success/30 bg-success/5 p-3 text-xs text-muted-foreground">
            <b className="text-success">Human approval boundary:</b> no booking, purchase, or
            binding commitment is authorized.
          </div>
        </section>
      </div>
    </div>
  );
}
