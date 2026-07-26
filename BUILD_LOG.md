# Build Log

## Goal & scope decisions

Built to the brief in full: parse → geocode → matrix → score → optimize → explain pipeline, deterministic optimizer, animated journey strip + map, first-reveal and re-plan animations, empty/loading/error states.

Cut to fit scope, as explicitly allowed by the brief:
- **SerpAPI / busy-times / crowd-level signal** — not built. The explanation prompt (`llmExplain.ts`) explicitly instructs the model not to reference crowd data, so the narration stays honest about what signals actually informed the plan.
- **Candidate-place search** (e.g. "find me a pharmacy near X") — not built. The user must name a specific place; Call 1's prompt is explicit that a task without an identifiable place is dropped rather than guessed.
- Redis caching — noted as the production upgrade path in both READMEs, not implemented; in-memory TTL cache is fine for a demo-scale, single-instance deployment.

The core optimizer and the signature animation — the two hardest and most load-bearing pieces — were kept fully intact and were not simplified.

## Stack & tooling

- Backend: Node/Express + TypeScript, deployed to Render. Chose Express route handlers over Next.js API routes to keep the backend a genuinely separate deployable service, matching the brief's Render/Vercel split.
- Frontend: Next.js 14 App Router + TypeScript + Tailwind + Framer Motion, deployed to Vercel.
- Map: MapLibre GL JS + OpenFreeMap vector tiles (`tiles.openfreemap.org/styles/liberty`) — no Mapbox token, no paid tile bill for a demo app.
- Testing: Vitest for the optimizer's pure functions (no network mocking needed, since `optimizer.ts` makes no network calls by construction).

## Key decisions & trade-offs

- **TomTom over a static-distance provider (e.g. GraphHopper without live traffic)**: the entire point of the app is ordering errands around *real* travel time. A haversine or free-flow estimate would produce plausible-looking but wrong plans at rush hour. See ARCHITECTURE.md for the full rationale.
- **Cerebras for `gpt-oss-120b`**: two of the three LLM calls sit in the user's synchronous wait time; Cerebras's inference speed matters more here than for a background job. `reasoning_effort` tuned per call (low for parse/score, medium for explain) rather than uniformly high, to keep the two latency-critical calls fast.
- **Optimizer as pure functions with zero imports of any HTTP client**: made the LLM/algorithm boundary a structural fact of the codebase, not just a design note — `optimizer.ts` genuinely cannot make a network call by construction, which is easy to verify by reading its import list.
- **Cheapest-insertion + 2-opt over a full TSP solver**: at this app's realistic scale (a handful of daily stops), an exact solver is unnecessary complexity; cheapest insertion with an urgency-weighted bonus, followed by a bounded 2-opt pass, gets a good-enough route in linear-ish time and stays easy to explain and unit test.

## Hard parts / dead ends

- **Route-draw animation race condition (real bug, caught during manual testing)**: `MapView.tsx`'s `requestAnimationFrame` loop for the "draw-on" route line used `coords[fullSegments]` without a bounds guard, and had no way to invalidate a stale animation loop from an overlapping re-plan. On the second `/plan` call in manual browser testing, this threw `TypeError: undefined is not iterable`, which crashed the animation loop (visible in the dev overlay) and left the page in a state where the "Plan my day" button stopped responding to clicks. Fixed by (1) making `interpolateLine` bounds-safe, and (2) adding a monotonic `routeDrawGenerationRef` so a stale animation loop no-ops instead of writing to the map source after a newer one has started. Caught precisely because the re-plan flow was manually exercised in a browser rather than assumed to work from the first successful render.
- **Framer Motion `layout` + scroll**: the Journey Strip's outer `motion.div` uses `layout`, which can produce a visually "swimming" artifact mid-scroll in some capture/rendering paths. Confirmed via `get_page_text` that this was a rendering-timing artifact, not missing content — the DOM was correct throughout.
- **Dark-mode contrast bug in the stop detail panel (real bug, caught during manual testing)**: `StopDetailPanel` originally used `bg-paper dark:bg-nightRaised`, which is nearly the same RGB value as the page's own dark-mode background (`rgb(38,33,28)` vs `rgb(28,24,21)`) — the panel was fully present and interactive in the DOM (confirmed via `elementFromPoint`) but visually invisible, blending into the backdrop. Fixed by adding a distinctly lighter `nightElevated` surface color and a stronger `shadow-elevated` box-shadow specifically for floating/modal surfaces, rather than reusing the same raised-panel tone used for static page sections.

## How it was verified

- Unit tests (`backend/src/__tests__/optimizer.test.ts`, 6 cases): single-task route, fixed-task ordering, an intentionally impossible two-fixed-window conflict (asserts a conflict string is surfaced, not silently dropped), cheapest-insertion placement, 2-opt never reordering fixed stops, total-duration arithmetic.
- Manual end-to-end browser testing against a stubbed backend (no real API keys required for UI verification): empty state, first-plan reveal animation, re-plan reorder animation (confirmed only changed-position stops/markers animate, conflict list correctly clears when the new order resolves it), mobile viewport (375×812, no horizontal overflow), dark-mode rendering.
- `tsc --noEmit` and `next build` / backend `tsc` both clean.
- **Live API pass (real Cerebras/TomTom/Geoapify keys, once provided)**: ran `/plan` end-to-end against real traffic and found two real bugs that unit tests and stubbed-backend UI testing couldn't have caught:
  1. **Geocoding without a proximity bias resolved place names globally.** "Aster Clinic JLT" and a fictional "Clean Express Marina" matched real places in Bangalore and Zagreb instead of Dubai, and TomTom's router then failed outright trying to route between continents. Fixed by biasing Geoapify's `/search` toward the user's start location and hard-filtering to within 75km (`backend/src/services/geocode.ts`) — a nonexistent/wrong-city place now correctly surfaces as a named geocode failure instead of silently resolving to the wrong continent.
  2. **A single-instant time mention ("at 4:20pm sharp") sometimes parsed to `time_window: null`** despite `flexibility: "fixed"`, which meant the two-fixed-window-conflict path (an explicitly required edge case) silently didn't fire for that phrasing. Fixed by tightening Call 1's system prompt with explicit single-instant-time guidance (`backend/src/services/llmParse.ts`), plus a defensive normalization in `plan.ts` so `flexibility: "fixed"` + `time_window: null` can never coexist regardless of what the LLM returns.
  - Re-verified after each fix: a 5-task realistic day, a single-task (n=1) plan, a genuinely impossible two-fixed-window conflict (both conflict strings now surface correctly), an ungeocodable place name (clean 422 with the specific place named), and a nonsense/gibberish input (clean 422, previous valid plan stays on screen rather than being wiped).
- Manual end-to-end browser testing (first against a stubbed backend, then against live APIs): empty state, first-plan reveal animation, re-plan reorder animation (confirmed only changed-position stops/markers animate, conflict list correctly clears when the new order resolves it), mobile viewport (375×812, no horizontal overflow), dark-mode rendering, the click-to-expand stop detail panel (including a dark-mode contrast bug caught and fixed — see below).
- `tsc --noEmit` and `next build` / backend `tsc` both clean, both before and after the live-API fixes.

## Known limitations

- All three external integrations (Cerebras, Geoapify, TomTom) have now been exercised against live traffic (see "Live API pass" above) and are confirmed working for realistic inputs. Rate limits on free tiers haven't been stress-tested.
- No candidate-place search — every task needs a named place.
- In-memory cache only; multi-instance Render deployments won't share cache state (noted as a Redis upgrade in the backend README).
- `next@14.2.35` still carries two known-high advisories (SSRF via rewrites, internal Server Function endpoint disclosure) that are only fully patched in Next 16; this app uses neither rewrites nor Server Actions, so exposure is low, but it's worth a deliberate upgrade decision before a real production launch.

## Time spent by phase (approximate)

- Backend skeleton, types, optimizer + tests: ~25%
- Backend services (Cerebras/Geoapify/TomTom wrappers) + routes: ~20%
- Frontend scaffold + components (static): ~20%
- Frontend animation (first-reveal + re-plan/FLIP) + bug fix: ~20%
- Polish, accessibility, docs: ~15%
