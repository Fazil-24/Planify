# PlanIFY backend

Express API that orchestrates Cerebras (LLM), Geoapify (geocoding), and TomTom (traffic-aware routing), and runs the deterministic route-ordering algorithm. Deployed to Render.

All three external API keys live only here — never sent to or bundled in the frontend.

## Run locally

```bash
cp .env.example .env
```

Fill in:

```
CEREBRAS_API_KEY=
TOMTOM_API_KEY=
GEOAPIFY_API_KEY=
FRONTEND_ORIGIN=http://localhost:3000
PORT=4000
```

```bash
npm install
npm run dev      # tsx watch, http://localhost:4000
npm test         # vitest — optimizer.ts unit tests
npm run build && npm start   # production
```

## Endpoints

- `POST /plan` — the main orchestration endpoint. Body: `RawTaskInput`, response: `PlanResponse` (see `src/types.ts` for the exact contract). Runs parse → geocode → matrix → score → optimize → explain in one request.
- `GET /geocode-search?q=...` — thin proxy to Geoapify autocomplete, used by the frontend's manual location search so the Geoapify key never reaches the client.
- `GET /health` — liveness check.

## Structure

```
src/
  routes/       plan.ts, geocodeSearch.ts — HTTP layer
  services/
    llmParse.ts, llmScore.ts, llmExplain.ts   — Cerebras calls (language/judgment)
    cerebrasClient.ts                          — shared OpenAI-compatible client
    geocode.ts                                 — Geoapify wrapper
    matrix.ts                                  — TomTom matrix + route geometry wrapper
    optimizer.ts                               — deterministic TSP-TW (no LLM, no network)
  utils/
    cache.ts      — in-memory TTL cache (geocode: 24h, matrix: 5min)
    retry.ts       — retry-with-backoff wrapper for all external calls
  __tests__/optimizer.test.ts
```

## API quirks discovered

- **TomTom Matrix**: synchronous requests are capped around 200 locations and ~10 req/min on the free tier — a non-issue at this app's scale (a handful of daily stops), but confirm current limits on TomTom's developer portal before scaling up, since pricing/limits pages change.
- **TomTom Routing**: `calculateRoute` takes a colon-separated `lat,lng:lat,lng:...` path segment, not a query param — easy to get wrong.
- **Cerebras / `gpt-oss-120b`**: it's a reasoning model — it can emit intermediate thinking content. Responses are defensively stripped of `<think>` blocks and markdown fences before JSON parsing, and a failed parse triggers one retry with a stricter system-prompt reminder.
- **Geoapify**: autocomplete (`/autocomplete`) and forward-geocoding (`/search`) are separate endpoints; the search endpoint is used for `geocodePlace` (best single match) while autocomplete backs the frontend's location search box (multiple suggestions).

## Production upgrade notes

- The in-memory cache (`utils/cache.ts`) works for a single-instance demo but would need to move to Redis for a real deployment (shared state across instances, survives restarts).
- CORS is configured via `FRONTEND_ORIGIN` (comma-separated) — set this to your Vercel domain(s) plus `localhost` during development.
