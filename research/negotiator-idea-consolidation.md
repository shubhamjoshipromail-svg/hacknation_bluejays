# The Negotiator — Idea Consolidation Strategy

Hack-Nation × ElevenLabs Challenge 01 · Prepared for Shubham · July 18, 2026
**Scope of this document: strategy and idea selection only. No build decisions are locked; nothing here is implementation.**

---

## 0. What I read, and one gap you should fix

Sources reviewed: the official challenge brief (source of truth), "deep-research-report (1)" (substantive market research recommending junk removal / moving / B2B dumpster-porta-toilet), and "deep-research-report (2)".

**Gap:** report (2) is *not* catering research. It is a generic academic topic-selection framework that mentions a catering-focused prompt only in its preamble. If real catering research exists, it was not attached. Everything below evaluates catering from the brief and first principles, marked accordingly. If you have the catering document, re-attach it and I'll revise.

Evidence labels used throughout:
**[FACT]** stated in the official brief · **[RESEARCH]** supported by attached research (cited secondary sources) · **[ASSUMPTION]** reasonable but unverified · **[OPEN]** must be validated before build.

---

## 1. Executive recommendation

**Primary direction: a junk-removal negotiator for a single, photographed apartment cleanout.** It is the best intersection of challenge compliance, demo reliability, natural document intake (photos), itemizable quotes, genuine negotiability, and low legal risk. This matches the attached research's conclusion, and my independent read of the brief agrees — with one addition the research missed: *differentiation risk*. The brief's own narrative is moving, so expect many moving submissions; junk removal is adjacent enough to inherit the pain story but fresh enough to stand out.

**Strongest differentiated alternative: windshield (auto-glass) replacement for a known VIN.** A VIN makes the job spec *perfectly* standardized — the strongest possible answer to "are the quotes truly comparable?" — with a famous hidden fee (ADAS camera recalibration) and real price-match behavior. Higher domain-knowledge burden, but memorable.

**Catering (your original direction): keep only as a fallback.** It is workable but mid-pack: quotes need menu back-and-forth, per-head prices are semi-published, and comparability across menus is genuinely hard — the exact failure mode the brief warns about ("collect prices that aren't comparable and hide the differences in a polished dashboard").

**Best long-term startup ≠ best hackathon build.** The startup wedge is B2B recurring local procurement (dumpsters, portable toilets, event rentals) — repeat purchase, measurable ROI, delegation already normal. Pitch it as the roadmap slide; build the consumer junk-removal loop this weekend.

---

## 2. Official challenge interpretation

### What the brief actually requires **[FACT]**

Three mandatory modules, one closed loop, one vertical of your choice:

1. **Estimator (intake):** voice interview on ElevenLabs Agents **plus** at least one document type (photos, bills, quotes, inventory); both paths produce the *same* structured job spec (e.g. JSON); user confirms it; it is reused **verbatim** on every call.
2. **Caller (quote gathering):** live calls against **at least three distinct negotiation styles** (real businesses, humans role-playing, or counter-agents — all valid); job described identically each time; friction handled (interruptions, evasion, "we'll call you back"); every quote captured structured and fee-itemized; show where a real call list would come from (Google Places / Yelp).
3. **Closer (negotiation + reporting):** at least one negotiation where price or terms **measurably change during the call because of leverage the agent gathered** — not script; red-flag rules applied (30%+ below market = warning, not win); final report ranks all quotes, cites recordings/transcripts, explains the pick in plain language.

The conversation requirement is explicit and graded: AI disclosure handled gracefully ("am I talking to a robot?"), barge-in/latency/turn-taking, a hard honesty line (never invent inventory, bids, or job facts — show *how* you constrain it), and every call ending in a structured outcome (itemized quote, callback commitment, or documented decline). **Play the calls in the demo and highlight these four points.**

Vertical parameters (spec taxonomy, benchmarks, red-flag rules, negotiation levers) must be **configuration, not code** — switching movers → auto body should mean swapping a config file.

### Likely judging priorities (inferred from "Strong vs Weak Submissions") **[FACT-adjacent]**

The brief tells you how it will be judged: real negotiation (price moves for a reason) beats screenplay; provable pain with real numbers beats cool-sounding verticals; a closed loop beats a polished fragment; honesty about hard parts beats bluffing. Its sharpest line: **"This challenge is won in call design, not model architecture."**

### Hidden expectations and common failure modes

- **Hidden expectation:** the counterparty simulation itself is judged. Counter-agents with real private pricing models whose prices move only for valid reasons demonstrate you understand negotiation; scripted counter-agents fail the "screenplay" test instantly.
- **Hidden expectation:** evidence architecture. "Ranked with transcript evidence" implies quotes must be traceable to the exact transcript moment the number was said.
- **Failure mode #1:** beautiful dashboard, no closed loop.
- **Failure mode #2:** three provider voices with one personality — "distinct negotiation styles" means distinct *behaviors under pressure*, not distinct accents.
- **Failure mode #3:** negotiation that's really a script ("can you do better?" → "sure, 10% off"). Judges will probe *why* the price moved.
- **Failure mode #4:** picking a vertical where quotes can't be normalized, then hiding it.
- **Failure mode #5:** skipping the AI-disclosure moment in the demo because it's awkward — the brief explicitly asks you to showcase it.

### Compliance checklist (carry through development)

| # | Requirement | Pass condition |
|---|---|---|
| 1 | Voice intake on ElevenLabs Agents | Interview produces the spec |
| 2 | ≥1 document type intake | Same schema output as interview |
| 3 | Single confirmed spec | User confirmation recorded; spec immutable after |
| 4 | Spec reused verbatim | Identical job description across all calls |
| 5 | ≥3 distinct negotiation styles, live | Distinct behaviors, not voices |
| 6 | Structured, itemized quotes | Every fee a line item with provenance |
| 7 | Friction handled | Interruption, evasion, callback, refusal each demonstrated |
| 8 | ≥1 measurable in-call improvement | Price/terms change traceable to verified leverage |
| 9 | Honesty constraints enforced | Mechanism shown, not asserted |
| 10 | AI disclosure | Graceful "yes, I'm an AI calling for a customer" |
| 11 | Structured call endings | Quote / callback / documented decline — never vague |
| 12 | Ranked, evidence-cited report | Transcript citations per claim; plain-language why |
| 13 | Recordings + transcripts preserved | Playable in demo |
| 14 | Config-not-code vertical | Show the config file for a second vertical |

---

## 3. Research synthesis

One coherent view from the brief + report (1):

**The core thesis holds.** Phone-priced markets persist for structural reasons: (a) jobs need conversational clarification before a price is credible; (b) supply is hyper-fragmented small firms (16,851 movers averaging 6.2 employees **[FACT]**; ~1/3 of small businesses lack a website **[RESEARCH]**); (c) opacity is *profitable* — FTC junk-fee enforcement and drip-pricing research show late fee disclosure is a business model **[RESEARCH]**; (d) availability and access constraints make prices genuinely dynamic. Google shipping AI business-calling in Search is strong third-party validation that calling is still the only way to get this data **[RESEARCH]**.

**The pain is documented, not hypothetical.** 5.6x spread on an identical 45-mile move ($1,158–$6,506); sight-unseen estimates 40% more likely to exceed the quote (FMCSA); 13,000+ BBB complaints/year against movers; hostage-load cases nearly tripled since 2017 **[FACT]**.

**The binding constraints are trust, law, and failure handling — not speech tech.** TCPA/TSR restricts automated outbound calling; ~11 states require all-party recording consent; the FCC treats AI voices in robocalls as illegal under TCPA (conversational, disclosed, low-volume calls are a different posture, but disclosure and consent are load-bearing) **[RESEARCH]**. For the hackathon: simulated/role-played counterparties eliminate nearly all legal exposure, and the brief explicitly blesses this **[FACT]**.

**LLM negotiators have known weaknesses.** 2025 literature: LLMs over-concede vs humans; explicit reasoning improved negotiation ~31% but at ~4x cost (bad for real-time latency) **[RESEARCH]**. Implication: negotiation policy should be substantially deterministic (a validated-leverage whitelist and concession rules), with the LLM handling phrasing and turn-taking — this is also exactly what the honesty requirement demands.

**Contradiction check.** Report (2) contributes almost nothing domain-specific; where it touches the space it agrees (voice-agent procurement is the best commercialization topic in its set). No material contradictions between brief and report (1). The one tension: the brief romanticizes *real* calls; the research correctly notes real providers are unreliable demo partners and legally fussy. Resolution: real calls as pre-build *validation* and optional demo garnish; simulated market as the demo backbone.

**Gaps in the research:** no catering evidence (missing file); no empirical data on how businesses react to disclosed AI callers (the single biggest open question **[OPEN]**); no forum-level complaint coding; scores in report (1) are analytic synthesis, not measured facts — treat the rank order as a hypothesis.

---

## 4. Industry evaluation — including fresh alternatives

You asked me to propose different niches if better ones exist. Beyond the research's candidates, I evaluated four additions: **windshield replacement (known VIN)**, **event rentals (fixed tables/chairs/tent)**, **self-storage units**, and **hotel room blocks**. Weighted scoring (weights: demo reliability & comparability 25, negotiability 20, phone dependence 15, doc-intake fit 10, pain/story 10, legal simplicity 10, differentiation vs other teams 10):

| Vertical | Comparability | Negotiability | Phone-dep. | Doc intake | Pain story | Legal | Differentiation | **Score** |
|---|---|---|---|---|---|---|---|---|
| **Junk removal (photographed cleanout)** | High | High | High | Photos — perfect | Strong | Low risk | Medium (research-obvious pick) | **86** |
| **Windshield replacement (known VIN)** | **Highest** (VIN = identical job) | Med-High (price-match is normal) | High | Insurance card / VIN photo / existing quote | Good (ADAS fee shock) | Low risk | **High** | **84** |
| Dumpster + porta-toilet (B2B) | High | High | High | Job sheet PDF | Weak for consumer judges | Low risk | High | 80 |
| Event rentals (fixed inventory) | **Highest** (identical SKUs) | Medium | Medium | Run-of-show / inventory list | Medium | Low risk | Medium-High | 78 |
| Local moving | Medium (broker/binding mess) | High | High | Inventory sheet | **Strongest** (brief's own numbers) | Medium (FMCSA-adjacent) | **Low — the default pick** | 76 |
| Corporate lunch catering (50 heads, recurring) | **Low-Medium** (menus differ) | Medium (service/delivery fees, not food) | Medium (menus online) | Menu PDFs, old invoices | Medium | Low risk | Medium | 68 |
| Self-storage (10x10 unit) | High | Medium | **Low-Medium** (web rates often *beat* phone) | Inventory photo → unit sizing | Good (teaser-rate hikes) | Low risk | High | 66 |
| Hotel room block (15 rooms, wedding) | Medium | High | Medium (email-contract heavy) | Event details doc | Medium | Low risk | High | 64 |
| Medical bills | Low (per-bill unique) | High | High | Itemized bill — perfect | Very strong | **High risk** | Low (crowded pick) | 58 |

**Why catering scores 68 [ASSUMPTION — missing research]:** the fatal issue is comparability. Two caterers quoting "lunch for 50" are quoting different food; normalizing taco bar vs sandwich platters invites exactly the "hide the differences in a dashboard" criticism. Real negotiation exists but concentrates in delivery/service/staffing fees, not the headline price. Quotes routinely require menu selection loops that don't finish in one call. It becomes viable only if you pin the spec brutally (e.g. "identical boxed-lunch spec, 50 units, weekly recurring") — at which point you've re-created the standardization that junk removal and auto glass get for free.

**Why self-storage and hotel blocks lose:** storage fails phone-necessity (large operators publish web rates below phone rates — a judge who knows this kills the premise); hotel blocks fail one-call resolution (sales offices quote by email contract over days).

**Recommendations by lens:**

| Lens | Pick |
|---|---|
| Best overall hackathon vertical | **Junk removal** |
| Most differentiated credible vertical | **Windshield/VIN** |
| Fastest MVP | Junk removal |
| Safest live demo | Junk removal (or event rentals) |
| Strongest B2B / startup wedge | Dumpster + porta-toilet procurement |
| Strongest consumer story | Local moving |
| Best long-term startup | B2B recurring local procurement platform |

The hackathon pick and the startup pick differ on purpose: the hackathon rewards demo clarity and a weekend-sized loop; a startup rewards repeat purchase and ROI. Judges reward teams who *know* this — one roadmap slide covers it.

---

## 5. Recommended narrow use case

**"Clear out a one-bedroom apartment before a move-out deadline."**

- **User:** a renter (or small landlord doing a turnover) with a hard move-out date.
- **Trigger:** lease ends in 10 days; sofa, mattress + box spring, desk, ~10 boxes, one mini-fridge must go.
- **User provides:** 4–8 photos of the items (document intake) + a 3-minute voice interview confirming: item list, estimated truck-load fraction, 3rd-floor walk-up / no elevator, curb distance, no hazardous items, two acceptable pickup windows, budget ceiling.
- **Agent does:** builds the canonical spec → user confirms → calls 3+ providers with the identical spec → extracts itemized quotes (base haul, stairs fee, mattress/appliance surcharge, same-day premium, disposal/environmental fee, minimums, tax, validity) → flags red flags (refusal to itemize, "starting-at" pricing, 30%+ below-market outlier) → calls back the runner-up with a *verified* rival total to negotiate → produces ranked, transcript-cited recommendation.
- **Providers do:** quote, evade, upsell, refuse, request callbacks — per distinct personas.
- **Measurable value:** all-in price improvement on at least one quote (e.g. stairs fee waived after citing a verified $420 all-in competitor), plus fee discovery ("Provider A's $299 excludes a $75 stairs fee and $40 mattress surcharge — real total $414").

Why this exact framing: photos are the most natural document intake in any vertical; "truck-fraction + access burden" gives a small, honest normalization basis; the stairs/mattress/same-day fees are legible to any judge in seconds; a one-bedroom load is small enough that one call yields a usable quote.

**Alternate narrow use case (if you choose the differentiated route):** "Replace the windshield on a 2021 RAV4 (VIN provided) with front camera." Document intake = insurance card or a competitor's written quote; hidden fees = ADAS recalibration, mobile-service fee, moldings, disposal; negotiation = price-match, which auto-glass shops actually do.

---

## 6. Product concept

- **Name:** **FairHaul** (junk-removal skin of a configurable engine — the config-not-code story is in the name architecture: FairHaul / FairGlass / FairMove are one YAML apart).
- **One-sentence pitch:** FairHaul photographs your junk, phones the market with one identical spec, extracts every hidden fee, and negotiates with verified quotes only — then shows you the receipts.
- **Target user:** renters and small landlords facing a dated cleanout.
- **Problem:** phone-priced haul-away with opaque fees, "starting-at" bait pricing, and no time to call 5 providers.
- **Current alternative:** call one or two providers, accept a vague range, get surprised on arrival — the Daniel pattern from the brief.
- **Why alternatives fail:** Google/Yelp show ratings, not prices; marketplace lead forms sell your number to 5 sales teams and still don't produce comparable itemized quotes; emailing gets ignored (these are phone-and-truck businesses); calling yourself costs hours and most people can't or won't negotiate.
- **Trust proposition:** every number on screen links to the second in the transcript where it was said; the agent provably cannot use unverified leverage; nothing is booked without your explicit approval.
- **Platform vision (roadmap slide only):** same engine, config-swapped into moving, auto glass, and then B2B recurring procurement (dumpsters, porta-toilets, event rentals) where the repeat-purchase economics live.

---

## 7. Competitive differentiation (ranked by judge appeal × feasibility × visibility)

1. **Verified-leverage negotiation ("no fake bids by construction")** — a deterministic validation layer that only releases negotiation claims backed by a transcript reference. This is the single most judge-differentiating feature because it operationalizes the honesty requirement instead of asserting it.
2. **Transcript-anchored evidence** — click any price, hear the moment it was said.
3. **One canonical spec, reused verbatim** — displayed side-by-side across calls to *prove* consistency.
4. **Fee-completeness detection** — the agent knows the vertical's fee taxonomy and actively asks about missing fees ("does that include stairs?"); "all-in total or it isn't a quote."
5. **Red-flag engine** — 30%-below-market outlier detection, refusal-to-itemize flags.
6. **Config-not-code verticals** — show the second config file for 30 seconds in the demo.
7. **Structured call endings** — every call terminates in quote / callback / documented decline.
8. Honest AI disclosure that keeps the quote (conversation-design craft, highly visible in demo).

Deliberately excluded as low-value sophistication: vector databases, retrieval, multi-agent swarms, negotiation "memory" across sessions, provider-behavior ML. None are needed for the loop and all violate the brief's over-engineering warning.

---

## 8. Architecture, schemas, agents, conversation and negotiation design (directional only — post-freeze work)

Per your instruction, no build detail is locked here. The consolidation-level positions:

- **Shape:** intake (voice + photos) → canonical JSON spec → confirm → simulated provider market (3–4 counter-agent personas with *private* cost models) → quote extraction to one schema → normalization + red flags → deterministic negotiation policy (validated leverage only) → ranked report with transcript citations. Human approval gate before anything binding; the agent never accepts terms.
- **Stack posture:** ElevenLabs Agents for all voices (buyer agent and counterparty agents), agent tools to log structured quote items mid-call, a thin backend + store for specs/quotes/transcripts, optional Twilio only if a real call proves safe. Essential: ElevenLabs Agents, structured tool-calling, one datastore. Useful: Google Places for the "where the call list comes from" slide. Overengineering: everything else.
- **Agent count:** two LLM roles (intake agent, caller/negotiator agent) plus counterparty agents; analysis and ranking mostly deterministic code. Resist a five-agent org chart.
- **Counterparty design (this is judged):** each persona gets a private cost floor, target margin, fee schedule, concession ladder, and triggers (e.g. "match verified competitor within 10% if schedule-flexible"). Prices move *only* when a trigger fires. Personas: budget-but-hidden-fees lowballer, premium white-glove, rushed dispatcher who evades, and a refuse-then-callback operator. That covers the ≥3 distinct styles plus the friction catalog.
- **Negotiation levers (truthful only):** verified competitor all-in total, schedule flexibility, curbside-only downgrade, photo-documented load certainty. Valid outcomes: lower total, waived stairs/fee, off-peak discount, longer quote validity. Forbidden by validation layer: invented bids, fake urgency, misrepresented inventory, agreeing to book.
- **Ranking:** deterministic score over all-in price, completeness, binding status, red flags, schedule fit; LLM writes only the plain-language explanation, citing stored evidence.

Full schemas, prompts, eval suite, and milestone plan belong to the next phase, after you freeze the vertical.

---

## 9. Trust & safety posture (MVP boundary)

- Agent **may autonomously**: interview, parse photos, call simulated providers, extract, negotiate within the validated-leverage whitelist, rank, report.
- Agent **always requires approval**: confirming the spec, any real outbound call, any callback commitment, accepting/booking anything.
- Agent **never**: invents facts or bids, discloses user PII beyond the job spec, makes payments, claims to be human (discloses AI when asked, and proactively at call open in the recommended design).
- Demo uses simulated counterparties → recording-consent and TCPA exposure ~zero **[RESEARCH]**; if one real call is included, it's a call *you* initiate about a real problem you actually have, with disclosure — the brief's own suggested pattern **[FACT]**.

---

## 10. Pre-mortem (top risks only)

| Risk | Prob. | Impact | Early warning | Mitigation |
|---|---|---|---|---|
| Negotiation reads as scripted | High | Fatal (core criterion) | Price moves without a traceable trigger | Private cost models + trigger logs shown on screen |
| Counterparty agents feel samey | Med-High | High | Personas differ only in voice | Write behavior specs (evasion, interruption, concession ladder) per persona; rehearse |
| Latency/barge-in ruins live calls | Medium | High | >1.5s turn gaps in rehearsal | Short agent turns; pre-recorded backup of every demo call segment |
| Loop not closed by demo time | Medium | Fatal | Any module still stubbed at T-24h | Build text-only end-to-end loop *first*, add voice after |
| Quote normalization contested | Low-Med (in junk removal) | Medium | Line items don't map across personas | Fixed fee taxonomy in config; agent forces itemization on-call |
| Over-scoping (real calls, extra verticals, fancy UI) | High | High | Backlog grows midway | This document is the scope contract; roadmap ≠ build |

---

## 11. Judge-style critique of the recommended concept

*Is the pain real?* Yes — borrow the brief's own moving numbers as the category evidence, then show junk removal shares the structure. *Why voice?* 16k+ phone-and-truck operators with no quoting software; the price only exists on the phone **[FACT]**. *Why AI?* Parallel calls, perfect spec consistency, fee-taxonomy recall, and negotiation stamina no consumer has. *Is negotiation genuine?* Yes if and only if counterparties have private cost models and the validation layer gates leverage — this is the make-or-break design. *Comparable quotes?* Photo-documented load + forced itemization + fixed taxonomy = defensible. *Could a form do this?* No — these providers don't answer forms, and forms can't push back on a "starting-at" price. *Memorable?* The moment a dispatcher says "are you a robot?", the agent says yes gracefully — and still gets the quote, then waives the stairs fee with a verified rival bid. That's the demo's beating heart.

Weakest point a judge will find: the simulated market. Counter it by (a) showing the counterparty cost-model configs after the calls, (b) citing the validation call log from real providers (see next actions), (c) optionally one real disclosed call about a genuine problem.

---

## 12. Consolidation decision & next actions

**1. Single strongest direction:** FairHaul — junk-removal negotiator for a photographed one-bedroom cleanout, on a config-driven engine, with verified-leverage-only negotiation and transcript-anchored evidence. (Windshield/VIN is the sanctioned pivot if the team wants higher differentiation and accepts more domain prep.)

**2. Smallest end-to-end baseline (build first, when building starts):** text-only closed loop — hardcoded spec → 3 persona counter-agents in text → quote extraction → one negotiation with one verified-leverage rule → ranked report with citations. Voice, photos, and UI wrap an already-working loop.

**3. Three most important uncertainties to validate now:**
   1. Do real junk-removal providers give usable itemized quotes to a (disclosed-assistant) caller in one call? → 5 manual validation calls, log answer/quote/itemization/negotiability/AI-objection.
   2. Can counterparty personas produce price movement that feels earned, not scripted? → tabletop role-play the negotiation in text before any voice work.
   3. Does the fee taxonomy cover reality? → collect 5 real quote structures (calls + published price pages) and check every fee maps to the schema.

**4. First concrete task (non-building):** freeze the vertical and run the validation sprint — one standardized cleanout scenario, 5 manual calls to real local providers, a 13-column log (answered, quoted, itemized, all-in total, hidden fees, negotiable?, AI objection, duration…). Half a day; it also generates the "real numbers" the brief demands for proving pain.

**5. Definition of done (hackathon MVP):** one uninterrupted run — photos + voice interview → one confirmed spec → three live persona calls with distinct styles, each ending in a structured outcome → one negotiation where the price measurably drops due to a validated verified quote → ranked report where every number is transcript-cited → AI-disclosure moment demonstrated → second-vertical config file shown. That is all 14 checklist rows green, and nothing more.
