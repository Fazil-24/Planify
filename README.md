# PlanIFY — Plan Intelligently For You

A smart daily-errand planner. Type your day's tasks in plain language — including where each one is — and PlanIFY turns them into a traffic-aware, optimally ordered route with a live map and a plain-language explanation of why the plan looks the way it does.

**Live URLs**
- Frontend: _add your Vercel URL here after deploying_
- Backend: _add your Render URL here after deploying_
- Video walkthrough: _add link here_

## What it does

1. Parses your free-text task list into structured tasks (Cerebras)
2. Geocodes each place you mentioned (Geoapify)
3. Builds a live, traffic-aware travel-time matrix between every stop (TomTom)
4. Scores each task's urgency (Cerebras)
5. Runs a deterministic algorithm to decide the best order — **no LLM touches the actual math**
6. Explains the plan in plain language (Cerebras)
7. Renders it as an animated journey strip + live map, with stops physically re-animating into new positions whenever you edit something

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full pipeline diagram and the reasoning behind the LLM-does-language / algorithm-does-math split.

## Structure

- [`/frontend`](frontend/README.md) — Next.js App Router UI, deployed to Vercel
- [`/backend`](backend/README.md) — Express API orchestrating Cerebras/Geoapify/TomTom, deployed to Render
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — pipeline diagram and design rationale
- [`DEPLOY.md`](DEPLOY.md) — step-by-step Render + Vercel deployment guide
- [`PROJECT_WRITEUP.md`](PROJECT_WRITEUP.md) — why every decision was made, cost breakdown, business angle, sample test data
- [`BUILD_LOG.md`](BUILD_LOG.md) — how this was built, decisions made, and known limitations

## Quick start

```bash
# Backend
cd backend
cp .env.example .env   # fill in CEREBRAS_API_KEY, TOMTOM_API_KEY, GEOAPIFY_API_KEY
npm install
npm run dev             # http://localhost:4000

# Frontend (separate terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev             # http://localhost:3000
```
