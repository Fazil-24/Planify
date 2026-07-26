# Build Log

## Goal & scope decisions

- Built the full pipeline: parse → geocode → matrix → score → optimize → explain, with animated UI (first-reveal, re-plan reorder, empty/loading/error states).
- Cut: crowd-density/busy-times signal, candidate-place search ("find me a pharmacy near X"), Redis caching. All explicitly out of scope per the brief; noted as v2 upgrades.
- Kept fully intact, no shortcuts: the deterministic optimizer and the signature reorder animation — the two hardest, most load-bearing pieces.

## Stack & tooling

- Backend: Node/Express + TypeScript on Render (separate from frontend so API keys never ship client-side).
- Frontend: Next.js 14 + TypeScript + Tailwind + Framer Motion on Vercel.
- Map: MapLibre GL JS + OpenFreeMap tiles (no Mapbox token/bill).
- Tests: Vitest on the optimizer's pure functions — no network mocking needed.

## Key decisions & trade-offs

- TomTom over a static-distance provider — live traffic is the whole value prop; a haversine estimate would look plausible but be wrong at rush hour.
- Cerebras for low-latency LLM calls in the user's synchronous wait path; `reasoning_effort` tuned low for parse/score, medium for the non-blocking explain call.
- Optimizer has zero imports of any HTTP client or LLM service — the LLM/algorithm split is enforced by the file's import list, not just documented.
- Cheapest-insertion + 2-opt over an exact TSP solver — right-sized for ~5-10 daily stops, deterministic, and easy to unit-test.

## Hard parts / dead ends

- Route-draw animation crashed on the second `/plan` call (unbounded array index + no way to cancel a stale animation loop) — froze the submit button. Fixed with a bounds check and a generation counter.
- Detail panel was invisible in dark mode — its background was nearly the same RGB as the page background, so it was present and interactive (confirmed via `elementFromPoint`) but unreadable. Fixed with a distinct elevated surface color.
- Map markers all clustered top-left until zoomed/dragged — MapLibre computed positions before its flex-layout container had a final size. Fixed with a `ResizeObserver` calling `map.resize()`.

## How it was verified

- 6 unit tests on the optimizer: single-task, fixed-task ordering, an impossible two-window conflict, cheapest-insertion placement, 2-opt never touching fixed stops, duration arithmetic.
- Manual browser testing against a stubbed backend first (empty/loading/error/reorder states, mobile viewport, dark mode), then against live Cerebras/TomTom/Geoapify keys.
- Live-API pass surfaced two real bugs unit tests couldn't catch:
  1. Geocoding without a location bias resolved place names globally (one match landed in Bangalore, another in Croatia), breaking TomTom routing. Fixed with proximity bias + a 75km hard filter.
  2. A single-instant time phrase ("at 4:20pm sharp") sometimes parsed to `time_window: null` despite `flexibility: "fixed"`, silently defeating conflict detection. Fixed the prompt and added a defensive normalization so that contradiction can't reach the optimizer.
- `tsc --noEmit` and `next build` clean throughout.

## Known limitations

- Hard-assumes car travel — no walk/bike/transit mode.
- No candidate-place search; every task needs a named place.
- In-memory cache only — fine for one instance, would need Redis to share across multiple.
- `next@14.2.35` carries two known advisories patched only in Next 16; this app doesn't use the affected features (rewrites, Server Actions), so exposure is low but worth a deliberate upgrade later.

## Time spent by phase (approximate)

- Backend (types, optimizer, tests): 25%
- Backend services (LLM/geocode/matrix wrappers, routes): 20%
- Frontend scaffold + components: 20%
- Frontend animation + bug fixes: 20%
- Polish, accessibility, docs: 15%
