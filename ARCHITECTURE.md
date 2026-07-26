# Architecture

## Design principle

PlanIFY splits every decision into one of two categories, and the code structure makes the split literal, not just documented:

- **Language and judgment under ambiguity** — parsing free text, scoring urgency, explaining the result in plain language — is handled by the LLM (Cerebras, `gpt-oss-120b`). These live in `backend/src/services/llmParse.ts`, `llmScore.ts`, `llmExplain.ts`.
- **The actual math** — deciding what order to visit stops in, given travel times and time windows — is handled by a deterministic algorithm that never calls an LLM and never makes a network request. It lives entirely in `backend/src/services/optimizer.ts`, is pure-function based, and is unit-tested without any network mocking (see `backend/src/__tests__/optimizer.test.ts`).

The LLM is never asked to compute a route order, a travel time, or an arrival time. The optimizer never asks an LLM anything. This boundary is enforced by the file boundary itself: `optimizer.ts` has no imports of `llmParse`/`llmScore`/`llmExplain`, `fetch`, or any HTTP client.

## Pipeline

```
User input (frontend)
   -> POST /plan (backend)
      -> Cerebras: parse text -> structured tasks         (llmParse.ts)
      -> Geoapify: geocode each place_name                (geocode.ts)
      -> TomTom: build travel-time matrix + route geometry (matrix.ts)
      -> Cerebras: score urgency per task                  (llmScore.ts)
      -> optimizer.ts: deterministic TSP-TW ordering (no LLM)
      -> Cerebras: generate plain-language explanation      (llmExplain.ts)
   <- PlanResponse (ordered stops, route geometry, explanation, conflicts)
Frontend: animated reveal / reorder
```

Everything above happens inside a single `POST /plan` request — the frontend makes one round trip and gets a complete `PlanResponse` back.

## The ordering algorithm

Implemented as four composable, independently-testable functions in `optimizer.ts`:

1. **`buildInitialRoute`** — pulls out tasks with a `time_window` and sorts them by start time. These become locked anchor points.
2. **`insertFlexibleTask`** — for each flexible task (highest urgency first), tries every gap in the current route and inserts it into the cheapest one, with a small discount proportional to `urgency_score` so urgent flexible tasks can justify a costlier slot.
3. **`twoOptImprove`** — repeatedly swaps adjacent non-fixed stops if the swap reduces total route time, capped at 50 iterations.
4. **`validateWindows`** — walks the final route computing cumulative arrival times, and emits a human-readable string into `conflicts[]` for any fixed window that can't actually be met, rather than silently producing an infeasible plan.

## Why TomTom over a static-distance provider

TomTom's Matrix Routing API returns **live-traffic-adjusted** travel times, not straight-line or free-flow distances. Since the entire premise of PlanIFY is ordering errands around real travel time, using a provider without live traffic (e.g. a haversine-distance estimate) would silently break the core value proposition — the plan would look plausible but be wrong at 5pm on a weekday. This was a deliberate, non-negotiable choice, not a swappable implementation detail.

## Why Cerebras

Two of the three LLM calls (parsing, scoring) sit directly in the user's wait time between hitting "Plan my day" and seeing a result. Cerebras's wafer-scale inference gives low-latency responses even for a 120B-parameter model, which matters more here than it would for an async/background LLM call. `reasoning_effort` is tuned per call — low for the two latency-sensitive extraction/classification calls, medium for the explanation call, which can render after the map animation has already settled.

## Caching and reliability

- Geocoding results are cached for 24h in-memory (place names rarely move).
- Matrix results are cached for 5 minutes (traffic is time-sensitive, but re-clicking "Plan my day" seconds apart shouldn't re-hit the API).
- Every external call (Cerebras, Geoapify, TomTom) goes through `utils/retry.ts` — 2 retries, exponential backoff, per-attempt timeout.
- A production deployment would swap the in-memory cache for Redis so cache state survives restarts and is shared across instances — noted here and in `backend/README.md` rather than built, to stay in scope for a demo-scale app.
