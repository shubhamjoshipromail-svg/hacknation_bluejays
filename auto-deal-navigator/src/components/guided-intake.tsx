import { useState, type FormEvent, type ReactNode } from "react";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  CreditCard,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/hooks/use-runs-data";
import { cn } from "@/lib/utils";
import type { SandboxIntakeRequest } from "../../../shared/contracts";

type Service = SandboxIntakeRequest["damage"]["service"];
type DamageType = SandboxIntakeRequest["damage"]["type"];
type DamageLocation = SandboxIntakeRequest["damage"]["location"];
type Feature = SandboxIntakeRequest["features"][number];
type VinDecode = {
  vin: string;
  year: number;
  make: string;
  model: string;
  adasLikely: boolean;
  adasEvidence: string[];
};

function Choice({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_-12px_var(--color-primary)]"
          : "border-border bg-white text-foreground hover:border-primary/55 hover:bg-primary/[0.04]",
      )}
    >
      {active && <Check className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

function SectionTitle({ number, title, hint }: { number: string; title: string; hint: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
        {number}
      </span>
      <div>
        <h2 className="text-base font-bold tracking-[-0.02em] text-foreground">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

export function GuidedIntake({ onCreated }: { onCreated: () => Promise<void> }) {
  const [vehicleMethod, setVehicleMethod] = useState<"vin" | "manual">("vin");
  const [vin, setVin] = useState("");
  const [vehicle, setVehicle] = useState({ year: 2021, make: "Volkswagen", model: "Tiguan" });
  const [decoded, setDecoded] = useState<VinDecode | null>(null);
  const [vinBusy, setVinBusy] = useState(false);
  const [vinError, setVinError] = useState<string | null>(null);
  const [service, setService] = useState<Service>("NOT_SURE");
  const [damageType, setDamageType] = useState<DamageType>("CRACK");
  const [damageLocation, setDamageLocation] = useState<DamageLocation>("CENTER");
  const [features, setFeatures] = useState<Feature[]>([]);
  const [adas, setAdas] = useState<boolean | null>(null);
  const [zip, setZip] = useState("28202");
  const [insurance, setInsurance] = useState(false);
  const [drivable, setDrivable] = useState(true);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("8am–12pm");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookupVin() {
    setVinBusy(true);
    setVinError(null);
    try {
      const result = (await api(`/api/vin/${vin.trim().toUpperCase()}`)) as VinDecode;
      setDecoded(result);
      setVehicle({ year: result.year, make: result.make, model: result.model });
      setAdas(result.adasLikely);
    } catch (reason) {
      setDecoded(null);
      setVinError(reason instanceof Error ? reason.message : "VIN lookup failed");
    } finally {
      setVinBusy(false);
    }
  }

  function toggleFeature(feature: Feature) {
    setFeatures((current) =>
      current.includes(feature)
        ? current.filter((item) => item !== feature)
        : [...current, feature],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (vehicleMethod === "vin" && !decoded) {
      setError("Look up the VIN first, or choose make and model instead.");
      return;
    }
    if (!date) {
      setError("Choose an appointment date before starting the calls.");
      return;
    }
    setBusy(true);
    setError(null);
    const selectedFeatures = new Set<Feature>(features);
    if (adas === true) selectedFeatures.add("FRONT_CAMERA");
    if (adas === false) selectedFeatures.delete("FRONT_CAMERA");
    const payload: SandboxIntakeRequest = {
      vehicle: { ...vehicle, vin: vehicleMethod === "vin" ? (decoded?.vin ?? null) : null },
      damage: { service, type: damageType, location: damageLocation, drivable },
      features: selectedFeatures.size ? [...selectedFeatures] : ["NOT_SURE"],
      postalCode: zip,
      insuranceInvolved: insurance,
      schedulePreference: `${format(date, "EEE, MMM d, yyyy")} · ${time}`,
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
    <div className="page-shell max-w-5xl">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Let’s find your best quote
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          Tell us about your windshield.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          We’ll identify the right glass, check camera calibration, and call configured sandbox
          providers for you.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-5">
        <section className="panel p-5 sm:p-7">
          <SectionTitle
            number="1"
            title="Which vehicle needs service?"
            hint="Use your VIN for the most accurate glass and camera match."
          />
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1.5">
            <button
              type="button"
              onClick={() => setVehicleMethod("vin")}
              className={cn(
                "rounded-lg px-3 py-2.5 text-sm font-semibold transition-all",
                vehicleMethod === "vin" ? "bg-white shadow-sm" : "text-muted-foreground",
              )}
            >
              Enter VIN
            </button>
            <button
              type="button"
              onClick={() => setVehicleMethod("manual")}
              className={cn(
                "rounded-lg px-3 py-2.5 text-sm font-semibold transition-all",
                vehicleMethod === "manual" ? "bg-white shadow-sm" : "text-muted-foreground",
              )}
            >
              Choose make & model
            </button>
          </div>
          {vehicleMethod === "vin" ? (
            <div>
              <label htmlFor="guided-vin" className="mb-2 block text-xs font-bold">
                Vehicle identification number
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Car className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="guided-vin"
                    value={vin}
                    maxLength={17}
                    onChange={(e) => {
                      setVin(e.target.value.toUpperCase());
                      setDecoded(null);
                    }}
                    placeholder="Enter 17-character VIN"
                    className="h-12 w-full rounded-xl border bg-white pl-10 pr-4 text-sm font-semibold uppercase tracking-[0.08em]"
                  />
                </div>
                <button
                  type="button"
                  disabled={vinBusy || vin.length !== 17}
                  onClick={lookupVin}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-bold text-white disabled:opacity-40"
                >
                  <Search className="h-4 w-4" /> {vinBusy ? "Checking…" : "Look up VIN"}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Found through the driver-side windshield or on your registration.
              </p>
              {vinError && <p className="mt-3 text-sm font-medium text-danger">{vinError}</p>}
              {decoded && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-success/25 bg-success/[0.08] p-3.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-bold">
                      {decoded.year} {decoded.make} {decoded.model}
                    </div>
                    <div className="text-xs text-muted-foreground">Verified through NHTSA vPIC</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold">
                Year
                <input
                  type="number"
                  min="1980"
                  max="2100"
                  value={vehicle.year}
                  onChange={(e) => setVehicle({ ...vehicle, year: Number(e.target.value) })}
                  className="mt-2 h-12 w-full rounded-xl border bg-white px-3 text-sm font-semibold"
                />
              </label>
              <label className="text-xs font-bold">
                Make
                <input
                  value={vehicle.make}
                  onChange={(e) => setVehicle({ ...vehicle, make: e.target.value })}
                  className="mt-2 h-12 w-full rounded-xl border bg-white px-3 text-sm font-semibold"
                />
              </label>
              <label className="text-xs font-bold">
                Model
                <input
                  value={vehicle.model}
                  onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                  className="mt-2 h-12 w-full rounded-xl border bg-white px-3 text-sm font-semibold"
                />
              </label>
            </div>
          )}
        </section>

        <section className="panel p-5 sm:p-7">
          <SectionTitle
            number="2"
            title="What happened to the glass?"
            hint="Choose the closest answers—the provider can confirm the details."
          />
          <p className="mb-2 text-xs font-bold">Service</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["REPLACEMENT", "Replace windshield"],
                ["REPAIR", "Repair chip or crack"],
                ["NOT_SURE", "Not sure"],
              ] as const
            ).map(([value, text]) => (
              <Choice key={value} active={service === value} onClick={() => setService(value)}>
                {text}
              </Choice>
            ))}
          </div>
          <p className="mb-2 mt-5 text-xs font-bold">Damage</p>
          <div className="flex flex-wrap gap-2">
            {(["CHIP", "CRACK", "SHATTERED", "OTHER", "NOT_SURE"] as DamageType[]).map((value) => (
              <Choice
                key={value}
                active={damageType === value}
                onClick={() => setDamageType(value)}
              >
                {value === "NOT_SURE" ? "Not sure" : value[0] + value.slice(1).toLowerCase()}
              </Choice>
            ))}
          </div>
          <p className="mb-2 mt-5 text-xs font-bold">Where is it?</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                "DRIVER_SIDE",
                "PASSENGER_SIDE",
                "CENTER",
                "EDGE",
                "MULTIPLE",
                "NOT_SURE",
              ] as DamageLocation[]
            ).map((value) => (
              <Choice
                key={value}
                active={damageLocation === value}
                onClick={() => setDamageLocation(value)}
              >
                {value
                  .split("_")
                  .map((word) => word[0] + word.slice(1).toLowerCase())
                  .join(" ")}
              </Choice>
            ))}
          </div>
        </section>

        <section className="panel p-5 sm:p-7">
          <SectionTitle
            number="3"
            title="Camera calibration"
            hint="We check this from your VIN whenever possible."
          />
          {decoded ? (
            <div className="rounded-xl border border-success/25 bg-success/[0.07] p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-success">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-bold">
                    {decoded.adasLikely
                      ? "Camera or driver-assistance equipment found"
                      : "No ADAS signal found in the VIN record"}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {decoded.adasEvidence[0] ??
                      "If you can see a camera near the mirror, correct this below."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDecoded(null)}
                className="mt-3 text-xs font-bold text-primary hover:underline"
              >
                That doesn’t look right—ask me instead
              </button>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-sm font-semibold">
                Is there a camera or sensor near your rear-view mirror?
              </p>
              <div className="flex flex-wrap gap-2">
                <Choice active={adas === true} onClick={() => setAdas(true)}>
                  Yes
                </Choice>
                <Choice active={adas === false} onClick={() => setAdas(false)}>
                  No
                </Choice>
                <Choice active={adas === null} onClick={() => setAdas(null)}>
                  I’m not sure
                </Choice>
              </div>
            </div>
          )}
          <div className="mt-5">
            <p className="mb-2 text-xs font-bold">Anything else you know?</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["RAIN_SENSOR", "Rain sensor"],
                  ["HEATED_GLASS", "Heated glass"],
                  ["HUD", "Heads-up display"],
                ] as const
              ).map(([value, text]) => (
                <Choice
                  key={value}
                  active={features.includes(value)}
                  onClick={() => toggleFeature(value)}
                >
                  {text}
                </Choice>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="panel p-5 sm:p-7">
            <SectionTitle
              number="4"
              title="Where should we search?"
              hint="We’ll call configured providers for this ZIP code."
            />
            <label htmlFor="guided-zip" className="relative block">
              <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="guided-zip"
                required
                value={zip}
                maxLength={5}
                inputMode="numeric"
                pattern="[0-9]{5}"
                onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                className="h-12 w-full rounded-xl border bg-white pl-10 pr-4 text-sm font-semibold"
                placeholder="ZIP code"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <Choice active={!insurance} onClick={() => setInsurance(false)}>
                <CreditCard className="h-3.5 w-3.5" /> Cash-pay
              </Choice>
              <Choice active={insurance} onClick={() => setInsurance(true)}>
                Use insurance
              </Choice>
            </div>
            <div className="mt-4">
              <Choice active={drivable} onClick={() => setDrivable(!drivable)}>
                Vehicle is drivable
              </Choice>
            </div>
          </div>
          <div className="panel p-5 sm:p-7">
            <SectionTitle
              number="5"
              title="When are you available?"
              hint="Pick a date, then choose a time window."
            />
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-12 w-full items-center justify-between rounded-xl border bg-white px-4 text-left text-sm font-semibold"
                >
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {date ? format(date, "EEE, MMM d, yyyy") : "Choose a date"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto rounded-2xl bg-white p-2 shadow-xl">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={{ before: new Date() }}
                />
              </PopoverContent>
            </Popover>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {["8am–12pm", "12pm–4pm", "4pm–7pm", "Any time"].map((value) => (
                <Choice key={value} active={time === value} onClick={() => setTime(value)}>
                  {value}
                </Choice>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger/[0.06] px-4 py-3 text-sm font-semibold text-danger">
            {error}
          </div>
        )}
        <section className="flex flex-col justify-between gap-5 rounded-2xl border border-primary/20 bg-primary/[0.07] p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Ready to search
            </div>
            <p className="mt-1 text-sm font-semibold">
              The agent can collect and negotiate quotes, but cannot book or buy without your
              approval.
            </p>
          </div>
          <button
            disabled={busy}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {busy ? "Starting calls…" : "Find and call providers"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      </form>
    </div>
  );
}
