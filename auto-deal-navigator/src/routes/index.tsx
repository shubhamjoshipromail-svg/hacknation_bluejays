import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { api, useRunsData } from "@/hooks/use-runs-data";

export const Route = createFileRoute("/")({ component: Workspace });
const money = (v: number | null | undefined) =>
  v == null
    ? "Not set"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(v / 100);
function Workspace() {
  const data = useRunsData();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [provider, setProvider] = useState("premium_chain");
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/negotiations/from-vin", {
        method: "POST",
        body: JSON.stringify({
          negotiationType: "auto_glass",
          objective: f.get("objective"),
          currentSituation: f.get("situation"),
          priorities: String(f.get("priorities"))
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          constraints: String(f.get("constraints"))
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          desiredOutcomeMinor: Number(f.get("target")) * 100 || null,
          walkAwayMinor: Number(f.get("walkaway")) * 100 || null,
          deadline: null,
          supportingContext: "",
          vin: String(f.get("vin")).trim().toUpperCase(),
          postalCode: f.get("zip"),
        }),
      });
      await data.refresh();
      setShowCreate(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create negotiation");
    } finally {
      setBusy(false);
    }
  }
  async function approve(action: string) {
    if (!data.negotiation) return;
    setBusy(true);
    try {
      await api(`/api/negotiations/${data.negotiation.negotiationId}/approvals`, {
        method: "POST",
        body: JSON.stringify({ action, details: "Approved in negotiation workspace" }),
      });
      await data.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  }
  async function startCall() {
    if (!data.negotiation) return;
    if (!window.confirm("Call the phone number configured in PERSONA_TO_NUMBER now?")) return;
    setBusy(true);
    setFormError(null);
    try {
      await api(`/api/negotiations/${data.negotiation.negotiationId}/calls`, {
        method: "POST",
        body: JSON.stringify({ provider }),
      });
      await data.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not start the call");
    } finally {
      setBusy(false);
    }
  }
  if (!data.negotiation || showCreate)
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-xs uppercase tracking-[.18em] text-primary">One guided workflow</p>
        <h1 className="mt-3 text-3xl font-semibold">Prepare your phone negotiation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the VIN once. The backend decodes the vehicle, builds one reusable specification,
          and keeps estimates separate from verified phone quotes.
        </p>
        {data.negotiation && (
          <button className="mt-4 text-sm text-primary" onClick={() => setShowCreate(false)}>
            ← Return to current negotiation
          </button>
        )}
        {data.connection === "error" && (
          <div className="mt-5 rounded border border-destructive/50 p-3 text-sm">
            Backend connection failed: {data.error}. Start it with <code>npm run server</code>.
          </div>
        )}
        <form onSubmit={create} className="panel mt-7 grid gap-4 p-6 md:grid-cols-2">
          <label className="md:col-span-2 text-sm">
            Objective
            <input
              required
              name="objective"
              className="mt-1 w-full rounded border bg-background p-2"
              defaultValue="Get a safe, itemized windshield replacement quote"
            />
          </label>
          <label className="md:col-span-2 text-sm">
            Current situation
            <textarea
              required
              name="situation"
              className="mt-1 w-full rounded border bg-background p-2"
              defaultValue="I need cash-pay windshield replacement with all required calibration included."
            />
          </label>
          <label className="text-sm">
            Priorities, comma separated
            <input
              required
              name="priorities"
              className="mt-1 w-full rounded border bg-background p-2"
              defaultValue="all-in price, safety, warranty"
            />
          </label>
          <label className="text-sm">
            Constraints
            <input
              name="constraints"
              className="mt-1 w-full rounded border bg-background p-2"
              defaultValue="no binding commitment, written confirmation"
            />
          </label>
          <label className="text-sm">
            Target ($)
            <input
              name="target"
              type="number"
              className="mt-1 w-full rounded border bg-background p-2"
              defaultValue="650"
            />
          </label>
          <label className="text-sm">
            Walk-away ($)
            <input
              name="walkaway"
              type="number"
              className="mt-1 w-full rounded border bg-background p-2"
              defaultValue="900"
            />
          </label>
          <label className="md:col-span-2 text-sm">
            Vehicle identification number (VIN)
            <input
              required
              name="vin"
              minLength={17}
              maxLength={17}
              pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}"
              className="mt-1 w-full rounded border bg-background p-2"
              defaultValue="3VV2B7AX0MM103995"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              NHTSA vPIC will decode year, make, model, trim, body class, and available ADAS
              evidence.
            </span>
          </label>
          <label className="text-sm">
            ZIP
            <input
              required
              pattern="[0-9]{5}"
              name="zip"
              className="mt-1 w-full rounded border bg-background p-2"
              defaultValue="28202"
            />
          </label>
          {formError && <p className="md:col-span-2 text-sm text-destructive">{formError}</p>}
          <button
            disabled={busy}
            className="md:col-span-2 rounded bg-primary px-4 py-2 font-medium text-primary-foreground"
          >
            {busy ? "Creating…" : "Create negotiation"}
          </button>
        </form>
      </div>
    );
  const n = data.negotiation;
  const confirmed = n.approvals.some((a) => a.action === "CONFIRM_SPEC"),
    calls = n.approvals.some((a) => a.action === "START_CALLS");
  return (
    <div className="mx-auto max-w-6xl px-6 py-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-primary">
            Status · {n.state.replaceAll("_", " ")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{n.intake.objective}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{n.intake.currentSituation}</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded border px-3 py-2 text-xs" onClick={() => setShowCreate(true)}>
            New VIN negotiation
          </button>
          <span className="rounded border px-3 py-2 text-xs">
            LIVE BACKEND · {n.negotiationId.slice(0, 12)}
          </span>
        </div>
      </div>
      <div className="mt-7 grid gap-5 lg:grid-cols-3">
        <section className="panel p-5">
          <h2 className="font-semibold">Intake & benchmark</h2>
          <p className="mt-3 text-sm">
            {n.intake.vehicle.year} {n.intake.vehicle.make} {n.intake.vehicle.model} · ZIP{" "}
            {n.intake.postalCode}
          </p>
          <div className="mt-4 rounded bg-panel-2 p-3">
            <p className="text-xs text-warning">
              {n.benchmark.classification} · {n.benchmark.sourceLabel}
            </p>
            <p className="mt-2 text-lg">
              {money(n.benchmark.lowMinor)}–{money(n.benchmark.highMinor)}
            </p>
            <p className="text-xs text-muted-foreground">
              Typical {money(n.benchmark.typicalMinor)}
            </p>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Sources: {n.intake.sources.map((s) => s.kind).join(", ")}
          </p>
        </section>
        <section className="panel p-5">
          <h2 className="font-semibold">Call-ready strategy</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Target</dt>
              <dd>{money(n.strategy.realisticTargetMinor)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Walk away</dt>
              <dd>{money(n.strategy.walkAwayMinor)}</dd>
            </div>
          </dl>
          <ul className="mt-4 list-disc space-y-2 pl-4 text-sm">
            {n.strategy.questions.slice(0, 3).map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
        <section className="panel p-5">
          <h2 className="font-semibold">Human control</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The assistant can analyze and suggest. It cannot call, counter, accept, share sensitive
            data, or confirm an agreement without the matching approval.
          </p>
          <button
            disabled={busy || confirmed}
            onClick={() => approve("CONFIRM_SPEC")}
            className="mt-4 w-full rounded border px-3 py-2 text-sm disabled:opacity-50"
          >
            {confirmed ? "✓ Spec confirmed" : "Confirm specification"}
          </button>
          <button
            disabled={busy || !confirmed || calls}
            onClick={() => approve("START_CALLS")}
            className="mt-3 w-full rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {calls ? "✓ Calls approved" : "Approve outbound calls"}
          </button>
          {calls && (
            <div className="mt-4 rounded border border-primary/30 bg-primary/5 p-3">
              <label className="text-xs text-muted-foreground">
                Test call style
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="mt-1 w-full rounded border bg-background p-2 text-sm text-foreground"
                >
                  <option value="premium_chain">Premium chain</option>
                  <option value="independent_lowballer">Independent lowballer</option>
                  <option value="mobile_operator">Mobile operator</option>
                </select>
              </label>
              <button
                disabled={busy || n.calls.some((call) => call.status === "IN_PROGRESS")}
                onClick={startCall}
                className="mt-3 w-full rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {n.calls.some((call) => call.status === "IN_PROGRESS")
                  ? "Call in progress…"
                  : busy
                    ? "Starting call…"
                    : "Call my phone now"}
              </button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Uses the separate Intake agent and the phone number configured in the backend.
              </p>
            </div>
          )}
          {formError && <p className="mt-3 text-xs text-destructive">{formError}</p>}
        </section>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-semibold">Offers & risks</h2>
          {n.offers.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No offer has been recorded. Approved calls will add transcript-backed itemized offers
              here.
            </p>
          ) : (
            n.offers.map((o) => (
              <div key={o.quoteId} className="mt-3 rounded border p-3">
                <b>{o.providerId}</b> · {money(o.totals.statedAllInMinor)}
              </div>
            ))
          )}
          {n.redFlags.map((r) => (
            <div
              key={r.code + r.detail}
              className="mt-3 rounded border border-warning/40 p-3 text-sm"
            >
              <b>
                {r.severity}: {r.code}
              </b>
              <p>{r.detail}</p>
            </div>
          ))}
        </section>
        <section className="panel p-5">
          <h2 className="font-semibold">Recommendation & follow-up</h2>
          {n.recommendation ? (
            <>
              <p className="mt-3 text-xl text-primary">{n.recommendation.action}</p>
              <p className="mt-2 text-sm">{n.recommendation.summary}</p>
              <ul className="mt-3 list-disc pl-4 text-xs text-muted-foreground">
                {n.recommendation.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              A recommendation appears after a reconciled offer is analyzed.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
