# PlanIFY frontend

Next.js App Router UI. Deployed to Vercel. Talks only to the PlanIFY backend's own `/plan` and `/geocode-search` endpoints — never calls Cerebras/Geoapify/TomTom directly, and holds no API keys.

## Run locally

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

```bash
npm install
npm run dev     # http://localhost:3000
```

The backend must be running (see `../backend/README.md`) for the app to do anything beyond the empty state.

## Structure

```
app/
  page.tsx                    — orchestrates input state, /plan calls, loading/error/empty states
  layout.tsx, globals.css     — fonts (Fraunces display / Inter body), warm palette
  components/
    TaskInput.tsx              — free-text task entry
    LocationInput.tsx          — geolocation auto-detect OR manual search via backend proxy
    JourneyStrip.tsx           — horizontal scrollable timeline, staggered reveal + FLIP reorder
    StopCard.tsx                — individual stop, framer-motion layoutId for reorder animation
    MapView.tsx                  — MapLibre map, lazy-loaded, animated marker drop-in + route draw-on
    LoadingSkeleton.tsx, ErrorState.tsx, EmptyState.tsx
    ExplanationPanel.tsx        — LLM's "why this order" narration
  lib/
    api.ts    — fetch wrappers for the backend
    types.ts  — mirrors backend/src/types.ts exactly
```

## Animation notes

- **First reveal**: Journey Strip cards stagger in (~90ms apart), map markers fade/drop in on the same stagger, the route line animates on via a `requestAnimationFrame` loop that progressively extends the GeoJSON line source's coordinates, and the explanation panel fades in last.
- **Re-plan**: stops are keyed by `id` (`layoutId` in Framer Motion), so only stops whose position actually changed animate — same technique (FLIP) drives both the Journey Strip cards and the map markers. The route line source is updated in place rather than replaced.
- The map is lazy-loaded (`next/dynamic`, `ssr: false`) since `maplibre-gl` is a non-trivial browser-only dependency.

## API quirks discovered

- MapLibre's `requestAnimationFrame`-driven source updates need a generation counter to guard against a slower, stale animation loop (e.g. from a fast double-submit) overwriting a newer route — see `routeDrawGenerationRef` in `MapView.tsx`.
- `next/font/google` requires network access at build time to fetch font files; if building in a fully offline environment, swap to local font files.
