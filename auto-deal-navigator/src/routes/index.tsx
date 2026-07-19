import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
import { HashChip } from "@/components/ui-bits";
import { useRunsData } from "@/hooks/use-runs-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: JobIntakePage,
  head: () => ({
    meta: [
      { title: "Start a quote · The Negotiator" },
      {
        name: "description",
        content: "Tell us about your vehicle and choose when you are available.",
      },
    ],
  }),
});

function ChoiceButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
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

function JobIntakePage() {
  const { jobSpec } = useRunsData();
  const [vehicleMethod, setVehicleMethod] = useState<"vin" | "manual">("vin");
  const [vin, setVin] = useState(jobSpec.vin.full);
  const [vinChecked, setVinChecked] = useState(true);
  const [service, setService] = useState(jobSpec.service.type);
  const [payment, setPayment] = useState(jobSpec.payment.type);
  const [zip, setZip] = useState(jobSpec.location.zip);
  const [adasManual, setAdasManual] = useState(false);
  const [adas, setAdas] = useState<boolean | null>(jobSpec.adas.confirmed);
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 6, 23));
  const [time, setTime] = useState("8am–12pm");

  return (
    <div className="page-shell max-w-5xl">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Let’s find your best quote
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Tell us about your windshield.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          We’ll identify the right glass, check camera calibration, and call local providers for
          you. It takes about two minutes.
        </p>
      </header>

      <div className="space-y-5">
        <section className="panel intake-card p-5 sm:p-7">
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
                vehicleMethod === "vin"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Enter VIN
            </button>
            <button
              type="button"
              onClick={() => setVehicleMethod("manual")}
              className={cn(
                "rounded-lg px-3 py-2.5 text-sm font-semibold transition-all",
                vehicleMethod === "manual"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Choose make & model
            </button>
          </div>

          {vehicleMethod === "vin" ? (
            <div>
              <label htmlFor="vin" className="mb-2 block text-xs font-bold text-foreground">
                Vehicle identification number
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Car className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="vin"
                    value={vin}
                    maxLength={17}
                    onChange={(e) => {
                      setVin(e.target.value.toUpperCase());
                      setVinChecked(false);
                    }}
                    placeholder="Enter 17-character VIN"
                    className="h-12 w-full rounded-xl border border-input bg-white pl-10 pr-4 text-sm font-semibold uppercase tracking-[0.08em] outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setVinChecked(vin.trim().length === 17)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-bold text-white transition hover:bg-foreground/85"
                >
                  <Search className="h-4 w-4" /> Look up VIN
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Usually visible through the driver-side windshield or on your registration.
              </p>
              {vinChecked && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-success/25 bg-success/[0.08] p-3.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      {jobSpec.vehicle.year} {jobSpec.vehicle.make} {jobSpec.vehicle.model}
                    </div>
                    <div className="text-xs text-muted-foreground">Vehicle found and matched</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold text-foreground">
                Year
                <select
                  defaultValue={jobSpec.vehicle.year}
                  className="mt-2 h-12 w-full rounded-xl border border-input bg-white px-3 text-sm font-semibold"
                >
                  <option>{jobSpec.vehicle.year}</option>
                  <option>2020</option>
                  <option>2019</option>
                </select>
              </label>
              <label className="text-xs font-bold text-foreground">
                Make
                <input
                  defaultValue={jobSpec.vehicle.make}
                  className="mt-2 h-12 w-full rounded-xl border border-input bg-white px-3 text-sm font-semibold"
                />
              </label>
              <label className="text-xs font-bold text-foreground">
                Model
                <input
                  defaultValue={jobSpec.vehicle.model}
                  className="mt-2 h-12 w-full rounded-xl border border-input bg-white px-3 text-sm font-semibold"
                />
              </label>
            </div>
          )}
        </section>

        <section className="panel intake-card p-5 sm:p-7">
          <SectionTitle
            number="2"
            title="What do you need?"
            hint="Choose the closest option—you can change it later."
          />
          <div className="flex flex-wrap gap-2">
            {["Windshield replacement", "Chip or crack repair", "Not sure yet"].map((option) => (
              <ChoiceButton
                key={option}
                active={service === option}
                onClick={() => setService(option)}
              >
                {option}
              </ChoiceButton>
            ))}
          </div>
        </section>

        <section className="panel intake-card p-5 sm:p-7">
          <SectionTitle
            number="3"
            title="Camera calibration"
            hint="We check this from your VIN whenever possible."
          />
          {vinChecked && !adasManual ? (
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-success/25 bg-success/[0.07] p-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </span>
                <div>
                  <div className="text-sm font-bold text-foreground">
                    Front camera found from VIN
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Calibration will be included when we compare provider quotes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdasManual(true)}
                className="text-left text-xs font-bold text-primary hover:underline"
              >
                That doesn’t look right
              </button>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-sm font-semibold text-foreground">
                Is there a camera or sensor near your rear-view mirror?
              </p>
              <div className="flex flex-wrap gap-2">
                <ChoiceButton active={adas === true} onClick={() => setAdas(true)}>
                  Yes
                </ChoiceButton>
                <ChoiceButton active={adas === false} onClick={() => setAdas(false)}>
                  No
                </ChoiceButton>
                <ChoiceButton active={adas === null} onClick={() => setAdas(null)}>
                  I’m not sure
                </ChoiceButton>
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="panel intake-card p-5 sm:p-7">
            <SectionTitle
              number="4"
              title="Where should we search?"
              hint="We’ll call providers near this ZIP code."
            />
            <label htmlFor="zip" className="relative block">
              <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="zip"
                value={zip}
                maxLength={5}
                inputMode="numeric"
                onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                className="h-12 w-full rounded-xl border border-input bg-white pl-10 pr-4 text-sm font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                placeholder="ZIP code"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Cash-pay", "Insurance"].map((option) => (
                <ChoiceButton
                  key={option}
                  active={payment === option}
                  onClick={() => setPayment(option)}
                >
                  <CreditCard className="h-3.5 w-3.5" /> {option}
                </ChoiceButton>
              ))}
            </div>
          </div>

          <div className="panel intake-card p-5 sm:p-7">
            <SectionTitle
              number="5"
              title="When are you available?"
              hint="Pick a date, then choose a time window."
            />
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-white px-4 text-left text-sm font-semibold transition hover:border-primary/55"
                >
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {date ? format(date, "EEE, MMM d, yyyy") : "Choose a date"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-auto rounded-2xl border-border bg-white p-2 shadow-xl"
              >
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={{ before: new Date(2026, 6, 19) }}
                />
              </PopoverContent>
            </Popover>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {["8am–12pm", "12pm–4pm", "4pm–7pm", "Any time"].map((option) => (
                <ChoiceButton key={option} active={time === option} onClick={() => setTime(option)}>
                  {option}
                </ChoiceButton>
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-between gap-5 rounded-2xl border border-primary/20 bg-primary/[0.07] p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Ready to search
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {jobSpec.vehicle.year} {jobSpec.vehicle.make} {jobSpec.vehicle.model} · {zip} ·{" "}
              {date ? format(date, "MMM d") : "Choose date"} · {time}
            </p>
            <div className="mt-2">
              <HashChip hash={jobSpec.hash} label="RUN" />
            </div>
          </div>
          <Link
            to="/calls"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-foreground/85"
          >
            Start calling providers <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}
