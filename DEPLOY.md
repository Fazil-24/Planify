# Deploying PlanIFY

Two separate deploys: backend to Render, frontend to Vercel. Deploy the backend first — the frontend needs its URL.

## 1. Backend → Render

1. Push this repo to GitHub (Render deploys from a git repo, not a local folder).
2. In the [Render dashboard](https://dashboard.render.com), click **New +** → **Web Service**.
3. Connect your GitHub repo, and set:
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance type**: Free is fine for a demo.
4. Under **Environment**, add these variables (values from your local `backend/.env`):
   ```
   CEREBRAS_API_KEY=<your key>
   TOMTOM_API_KEY=<your key>
   GEOAPIFY_API_KEY=<your key>
   FRONTEND_ORIGIN=http://localhost:3000
   ```
   Leave `PORT` unset — Render injects its own `PORT` and Express already reads `process.env.PORT`.
5. Deploy. Render gives you a URL like `https://planify-backend.onrender.com`.
6. Once you've deployed the frontend (step 2) and know its Vercel URL, come back and update `FRONTEND_ORIGIN` to a comma-separated list including it, e.g.:
   ```
   FRONTEND_ORIGIN=https://planify.vercel.app,http://localhost:3000
   ```
   Then trigger a redeploy (Render → **Manual Deploy** → **Deploy latest commit**) so the new CORS origin takes effect.
7. Sanity check: `curl https://<your-render-url>/health` should return `{"status":"ok"}`.

**Free tier note**: Render's free web services spin down after 15 minutes of inactivity and take ~30-60s to cold-start on the next request. That first `/plan` call after idle time will feel slow — this is Render, not your code. Fine for a demo; a paid instance avoids it.

## 2. Frontend → Vercel

1. In the [Vercel dashboard](https://vercel.com/new), import the same GitHub repo.
2. Set:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js (auto-detected)
3. Under **Environment Variables**, add:
   ```
   NEXT_PUBLIC_BACKEND_URL=https://<your-render-url>
   ```
   (no trailing slash)
4. Deploy. Vercel gives you a URL like `https://planify.vercel.app`.
5. Go back to Render and make sure `FRONTEND_ORIGIN` includes this exact URL (step 6 above) — without it, every `/plan` request will fail with a CORS error in the browser console, even though the backend itself is healthy.

## 3. Verify end-to-end

Open the Vercel URL, allow location access (or search a start address), type a task, and click "Plan my day". Watch the Render logs (dashboard → your service → **Logs**) if anything fails — the backend logs which external API call failed and why (see `utils/retry.ts` — failures are logged per attempt).

## Common gotchas

- **CORS error in browser console, backend is up**: `FRONTEND_ORIGIN` on Render doesn't include your exact Vercel URL (check for trailing slash mismatches, `www.` differences, or preview-deployment URLs — Vercel gives every branch/PR its own URL, which won't match unless added).
- **502 from `/plan`, backend logs show a Geoapify/TomTom error**: double check the keys were pasted without extra whitespace, and that your Geoapify/TomTom account isn't rate-limited (free tiers: TomTom ~10 req/min on matrix, Geoapify ~3000 req/day — check current limits on each provider's portal, as these change).
- **Slow first request**: see the Render free-tier cold-start note above.
