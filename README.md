<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/32bbba00-d4f5-4842-aecb-e0bc7ff7bccd

## Run Locally

**Prerequisites:** Node.js 20+

1. Install dependencies: `npm install`
2. Copy `.env.example` → `.env.local` and set `GEMINI_API_KEY`
3. Dev server: `npm run dev` → http://localhost:3000
4. Production preview: `npm run preview`

## Publish as a PWA

See **[DEPLOY.md](./DEPLOY.md)** for full hosting guides (Render, Railway, Fly.io, Cloud Run, VPS).

Quick path: deploy with Docker on **Railway** or **Render** + set `GEMINI_API_KEY`.

After HTTPS deploy, users can **Install app** (Android/Desktop) or **Add to Home Screen** (iPhone).

## Kitchen Pipeline

1. **Discover** — `POST /api/catalog/discover` with ingredients → finds 5–10 YouTube dishes per ingredient and saves to SQLite (`data/vigadi.db`)
2. **Build** — `POST /api/combos/build` with ingredients + combo rules → assembles 2 full meal combos from the catalog
3. **Select** — `POST /api/combos/select` when user picks a combo → updates per-user taste profile for future suggestions

Other endpoints: `GET /api/catalog/dishes`, `GET /api/taste/:userId`, `POST /api/feedback/dish`
