# PlanIFY — Project Writeup & Interview Prep

A single reference document explaining every major decision in this project, why it was made, what it costs to run, and how to talk about it in an interview. Pairs with [ARCHITECTURE.md](ARCHITECTURE.md) (pipeline diagram) and [BUILD_LOG.md](BUILD_LOG.md) (chronological build notes, bugs found).

---

## 1. The problem, in one sentence

Turn a messy paragraph of errands into a route that actually respects real-world constraints — appointment times, live traffic, and how urgent each thing is — without asking an LLM to do arithmetic it's bad at.

That last clause is the whole architectural thesis of this project. Everything else is downstream of it.

---

## 2. Why this architecture: LLM for language, algorithm for math

**The decision:** three narrow LLM calls (parse free text → structured tasks; score urgency; narrate the final order) and one deterministic algorithm (decide the actual stop order) that never touches an LLM and never makes a network call.

**Why:** LLMs are excellent at ambiguity — "pick up the kids' stuff before it gets busy" → inferring a task, a rough duration, an urgency signal — and unreliable at precise multi-step optimization. Asking an LLM "what order should I visit these 5 places in, given these 5 time windows and this travel matrix" is exactly the kind of task where it will confidently produce a *plausible-looking* wrong answer — it might drop a constraint, silently reorder something that has to be fixed, or just be inconsistent between two runs on identical input. A classic 2-opt/cheapest-insertion algorithm gets the *same* input and produces the *same, provably reasoned* output every time.

**How it's enforced, not just documented:** `backend/src/services/optimizer.ts` has zero imports of `fetch`, any HTTP client, or any of the `llm*.ts` files. That's a structural fact you can verify by reading the import list, not a policy someone has to remember to follow. This is the single most interview-worthy decision in the project — it shows you understand *where* LLMs are strong vs. where they quietly become a liability, and that you designed the codebase so that boundary can't erode over time.

**Interview soundbite:** *"I didn't want an LLM anywhere near the actual math. It parses, it judges, it explains — but a deterministic algorithm decides the route, and that algorithm has no import of a network client, so the boundary is enforced by the file system, not a comment."*

---

## 3. The optimizer, in depth

Four composable functions:

1. **`buildInitialRoute`** — pull out tasks with a `time_window`, sort by start time. These are locked anchors.
2. **`insertFlexibleTask`** — cheapest-insertion heuristic. For each flexible task (highest urgency first), try every gap in the route, pick the cheapest, with a small discount proportional to `urgency_score` so an urgent flexible task can justify a slightly costlier slot.
3. **`twoOptImprove`** — bounded local search (max 50 iterations): swap adjacent non-fixed stops if it reduces total time. Never touches fixed stops.
4. **`validateWindows`** — walk the final route, compute cumulative arrival times, and if a fixed window can't actually be met, push a human-readable string into `conflicts[]` instead of pretending the plan works.

**Why cheapest-insertion + 2-opt instead of an exact TSP solver (branch-and-bound, Held-Karp, ILP):** at this app's real scale (a handful of daily errands, not 500 delivery stops), an exact solver is wasted complexity for a gain nobody will notice. Cheapest-insertion is O(n²) per insertion and converges to a good-enough answer fast; 2-opt cleans up the remaining slack. It's also *easy to explain in an interview* and *easy to unit-test* — both matter more here than shaving 2% off total drive time on a 5-stop route.

**Why not a genetic algorithm / simulated annealing:** massive overkill for n≤10ish stops, non-deterministic (bad for testing and for user trust — "why did it give me a different answer this time?"), and harder to explain to a non-technical stakeholder than "it tries the cheapest slot for each task."

---

## 4. Why each technology

| Choice | Why | What I'd say if challenged |
|---|---|---|
| **Next.js App Router** | Modern React default, file-based routing, easy Vercel deploy, `next/dynamic` for lazy-loading the map | "Could've been CRA + separate router, but App Router's layout/loading conventions map cleanly onto this app's states" |
| **Separate Express backend** (not Next API routes) | The brief wanted a genuinely separate deployable service (Render + Vercel split), which also means the backend can scale/restart independently of the frontend, and API keys never enter the same deploy artifact as client code | "Next API routes would've worked too, but co-locating them blurs the 'frontend never touches the keys' boundary and couples two independently-scaling concerns" |
| **TypeScript everywhere** | Shared `types.ts` contract between frontend/backend catches drift at compile time, not in production | — |
| **Tailwind + Framer Motion** | Utility-first CSS ships fast without a separate stylesheet to keep in sync; Framer Motion's `layout`/`layoutId` gives FLIP-based reorder animation almost for free | "Could hand-roll CSS transitions, but I'd be reimplementing FLIP measurement logic Framer Motion already solved" |
| **MapLibre GL JS + OpenFreeMap tiles** | Mapbox GL JS requires a paid token past a free quota; MapLibre is the open-source fork with an identical API, paired with free vector tiles | "Zero-cost to run this demo forever, and the migration path back to Mapbox GL if I needed their extra features is a one-line import swap" |
| **Cerebras (`gpt-oss-120b`)** | Two of the three LLM calls sit in the user's synchronous wait time. Cerebras's wafer-scale inference is dramatically faster than typical GPU-served endpoints for the same open-weight model — that latency budget matters more here than for a background job | "I benchmarked perceived latency, not just cost — a slow LLM call in the critical path kills the 'feels instant' experience this app is selling" |
| **TomTom (Matrix + Routing)** | Live-traffic-adjusted travel times, not free-flow/haversine estimates — the entire value proposition depends on real drive times | "Google Distance Matrix would also work but costs more per call at this volume; a distance-only provider like OSRM without live traffic silently breaks the pitch" |
| **Geoapify** | Cheap/generous free tier, has both forward-geocoding and autocomplete on the same key, decent global coverage | "Google Places is more accurate for ambiguous small businesses but meaningfully more expensive per call at scale" |
| **Render (backend) / Vercel (frontend)** | Matches the brief exactly; both have zero-cost tiers suitable for a demo | — |
| **In-memory TTL cache, not Redis** | Right-sized for a single-instance demo; the README explicitly calls out Redis as the production upgrade | "I didn't build infrastructure I couldn't justify at this traffic level — over-engineering here would read as not understanding the actual scale" |

---

## 5. Cost per plan generation (researched, not guessed)

Pricing changes, so these are estimates from current published rates, not a bill you can hand someone — but they're directionally right and show you can reason about unit economics.

**Cerebras (`gpt-oss-120b`): $0.35 / M input tokens, $0.75 / M output tokens**
Per `/plan` call, three requests:
- Call 1 (parse): ~400 input tokens (system prompt + free text), ~150 output tokens (JSON tasks) — low reasoning effort
- Call 2 (score): ~400 input, ~100 output — low reasoning effort
- Call 3 (explain): ~500 input, ~300-500 output including reasoning tokens (medium effort, reasoning tokens bill as output)

Total ≈ 1,300 input + 850 output tokens → **≈ $0.0011 per plan** (about a tenth of a cent).

**Geoapify: free up to 3,000 requests/day, then ≈ $0.006/request on the Pro tier**
One geocode call per task. A 3-task plan = 3 requests. Within free tier for any realistic demo/personal-use volume (3,000/day ÷ 3 per plan ≈ **1,000 free plans/day**). Beyond that: ≈ $0.018/plan.

**TomTom: free up to 2,500 transactions/day, then ≈ $0.50/1,000 transactions**
One Matrix call (roughly origins×destinations transactions — a 4-location day is ~16 transactions) + one Routing call (~1-4 transactions depending on waypoint count). Call it ~20 transactions/plan → **≈ 125 free plans/day**, then ≈ $0.01/plan beyond that.

**Bottom line:** for a demo, a portfolio piece, or genuinely light personal use (well under ~100 plans/day), **this app costs $0 to run** — every provider's free tier covers it. The moment you're past free tiers, a plan costs roughly **$0.01–$0.03**, and TomTom's transaction volume (not the LLM) is the dominant cost driver, not the AI part people assume is expensive. That's a genuinely interesting thing to say in an interview: *"the AI is the cheap part; the mapping data is the expensive part."*

At, say, 10,000 plans/month past free tiers: ~$100–$300/month in external API costs — cheap enough that the real cost driver for a real product would be hosting/support/growth, not inference.

Sources: [Cerebras pricing](https://www.morphllm.com/cerebras-pricing), [TomTom pricing](https://docs.tomtom.com/pricing), [Geoapify pricing](https://www.geoapify.com/pricing/).

---

## 6. Business angle

**Who this is for:** anyone whose day involves 3+ physical errands with at least one hard time constraint — parents, caregivers, small-business owners doing their own logistics, gig workers, people managing errands for elderly relatives. It is explicitly *not* for people with a single calendar-driven day (that's Google Calendar's job) or for commercial fleet routing (that's a different, much heavier product — Route4Me, OptimoRoute, Onfleet).

**Competitive landscape:**
- **Google Maps "your timeline"** — shows history, doesn't plan or optimize a future multi-stop day around time windows.
- **Todoist / Sunsama / Motion** — task/time management, but none of them geocode your tasks or reason about drive time between them.
- **Route4Me / OptimoRoute** — solve the *actual* routing problem well, but are B2B fleet tools with per-driver pricing, not something a person plans their Tuesday with.

PlanIFY sits in a real gap: consumer-facing, errand-specific, traffic-aware, single-day route planning. Nobody is squarely in this niche today because it requires stitching together LLM parsing + geocoding + live routing + a genuinely good optimizer — most "AI planner" apps skip the deterministic-optimizer part entirely and just ask the LLM to "suggest an order," which is the exact anti-pattern this project deliberately avoids.

**Monetization ideas (not built, but a natural next conversation):**
- Freemium: N free plans/day, unlimited for a small subscription — directly mirrors the free-tier ceilings above, so the cost model and the pricing model are the same shape.
- B2B angle: white-label for home-care agencies or courier-adjacent small businesses that route a single person's day, not a fleet.
- The "why this order" explanation is a genuine differentiator for trust — most routing tools give you an order with no rationale; this one is designed to justify itself in plain language, which matters a lot for a human who has to actually follow the plan and will second-guess it otherwise.

**What's missing for a real product (be upfront about this in an interview — it shows maturity, not weakness):** no persistence/accounts (a session-only demo), no multi-day planning, no recurring errands, no calendar integration, no live re-routing if a task takes longer than estimated mid-day. All reasonable v2 scope, deliberately cut to keep this build focused.

---

## 7. Notable engineering decisions worth mentioning in an interview

- **Every real bug found was found by actually running the thing**, not by code review alone: a geocoding-without-bias bug that sent "Aster Clinic JLT" to Bangalore and a fictional place to Croatia (fixed with proximity bias + a 75km hard filter); a route-draw animation race condition that crashed on the second plan generation and froze the submit button (fixed with bounds-checking + a generation counter); an LLM contradiction where `flexibility: "fixed"` came back with `time_window: null` for single-instant time phrases, silently defeating conflict detection (fixed with a tightened prompt *and* a defensive normalization so the contradiction structurally can't reach the optimizer); and a MapLibre marker-clustering bug caused by the map computing pixel positions before its flex-layout container had a final size (fixed with a `ResizeObserver`). Being able to narrate *how each was diagnosed*, not just that it was fixed, is a stronger interview story than a bug-free demo would be.
- **Defensive LLM output handling**: every LLM call strips reasoning-model artifacts (`<think>` blocks, markdown fences) before `JSON.parse`, and retries once with a stricter prompt on parse failure — because "the model returns valid JSON" is an assumption, not a guarantee.
- **Accessibility wasn't bolted on**: semantic landmarks, `aria-pressed`/`aria-label` on every interactive control (including canvas-rendered map markers, which are easy to forget), keyboard arrow-key scrolling on the journey list, focus management on the modal (focus moves in on open, Escape closes, focus ring visible).
- **The UI redesign was iterative and responsive to feedback** (warm-editorial → neon-cosmic → checkbox completion → sidebar layout) — a good story about taking direction rather than being precious about a first design pass.

---

## 8. Anticipated interview questions

**"Why didn't you just ask the LLM to order the stops too, in one call?"**
Because it would have been unreliable and unverifiable. I can unit-test `optimizer.ts` with zero network mocking and get the same answer every time for the same input. I can't do that for an LLM's ordering decision, and a routing app that gives different answers to identical questions loses user trust fast.

**"What happens if TomTom or Geoapify goes down?"**
Every external call goes through a shared retry-with-backoff wrapper (2 retries, exponential backoff, per-attempt timeout). If it still fails, `/plan` returns a distinguishable error (a 422 naming the specific place that failed to geocode, or a 502 for a genuine upstream failure) rather than a blank screen — the frontend has explicit states for both.

**"How would you scale this to 100,000 users?"**
The in-memory cache becomes Redis (shared across instances, survives restarts). The backend is already stateless per-request, so it horizontally scales behind Render's load balancer without code changes. The real bottleneck would be TomTom/Geoapify rate limits, which would push toward negotiating a volume contract or adding a queueing layer for matrix requests during traffic spikes.

**"What would you do differently if you had another week?"**
Persistence (accounts + saved plans), a real transport-mode selector (car/walk/transit — currently hard-defaults to car, a known limitation I flagged rather than hid), and an "optimization emphasis" toggle (speed vs. urgency-weighted) as a genuine lever rather than a cosmetic sort dropdown.

---

## 9. Running it locally

```bash
# Backend
cd backend
cp .env.example .env   # fill in CEREBRAS_API_KEY, TOMTOM_API_KEY, GEOAPIFY_API_KEY
npm install
npm run dev             # http://localhost:4000

# Frontend — separate terminal
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
npm install
npm run dev             # http://localhost:3000
```

Open `http://localhost:3000`, allow location access (or search a start address), paste one of the sample task lists below, click "Plan my day."

Run the optimizer's unit tests any time with `cd backend && npm test` — no API keys required, since `optimizer.ts` makes no network calls.

---

## 10. Sample task lists for manual testing

Real, verified-geocodable place names for two very different cities — good for demonstrating that the pipeline isn't hardcoded to one region. Set your start location to a real address in the matching city first (search it, or use "Use my location" if you're actually there).

### Dubai (start location: search "Dubai Marina")

**1. Realistic mixed day (1 fixed, 2 flexible)**
```
Pick up prescription at Life Pharmacy Marina, dentist appointment at Aster Clinic JLT around 4pm, groceries at Spinneys Al Wasl before dinner
```

**2. Many tasks (5), tests the vertical sidebar list + 2-opt**
```
Coffee at Starbucks Marina Walk, pick up prescription at Life Pharmacy Marina, dentist appointment at Aster Clinic JLT around 4pm, gym session at Fitness First JBR around 7pm, groceries at Spinneys Al Wasl before dinner
```

**3. Deliberate conflict (two tight, far-apart fixed windows — should surface conflicts, not silently break)**
```
Dentist appointment at Aster Clinic JLT from 4:00pm to 4:15pm sharp, and a checkup at Mediclinic City Hospital at 4:20pm sharp
```

**4. Single task (n=1 edge case)**
```
Quick coffee run at Starbucks Marina Walk
```

**5. Landmark/shopping day**
```
Buy a gift at Dubai Mall, browse electronics at Mall of the Emirates around 1pm, pick up a parcel at Dubai Marina Mall
```

**6. Ungeocodable place (tests the geocode-failure error state)**
```
Pick up dry cleaning at Ali's Magic Cleaners, dentist appointment at Aster Clinic JLT around 4pm
```

### Bangalore (start location: search "Koramangala, Bangalore")

**1. Realistic mixed day**
```
Pick up medicines at Apollo Pharmacy Koramangala, doctor appointment at Manipal Hospital around 4pm, groceries at More Supermarket Koramangala before dinner
```

**2. Many tasks (5)**
```
Coffee at Third Wave Coffee Indiranagar, pick up medicines at Apollo Pharmacy Koramangala, doctor appointment at Manipal Hospital around 4pm, gym session at Cult Fit Koramangala around 7pm, dinner shopping at Forum Mall Koramangala
```

**3. Deliberate conflict**
```
Doctor appointment at Manipal Hospital from 4:00pm to 4:15pm sharp, and a follow-up at Fortis Hospital Bannerghatta Road at 4:20pm sharp
```

**4. Single task**
```
Quick coffee run at Third Wave Coffee Indiranagar
```

**5. Landmark/shopping day**
```
Buy a gift at UB City Mall, browse books at Blossom Book House around 2pm, pick up a parcel at Total Mall Sarjapur Road
```

**6. Ungeocodable place**
```
Pick up laundry at Sunshine Wash Corner, doctor appointment at Manipal Hospital around 4pm
```

**Note:** geocoding is biased toward whatever start location you set, but it isn't magic — if a place name is genuinely ambiguous or the LLM/Geoapify can't confidently resolve it, you'll correctly get the error state rather than a wrong-city result (that's the fix from the earlier proximity bug, working as intended). If a "real" place above happens to not resolve in your testing (business names change), swap in any real, well-known place near your test city.
