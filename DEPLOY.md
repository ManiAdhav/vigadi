# Deploy & publish Vígadi as a PWA

Vígadi is a **full-stack Node app** (Express API + React PWA + SQLite). You need a host that runs Node.js and supports a **persistent disk** for `data/vigadi.db`.

---

## What makes it installable as a PWA

After deployment over **HTTPS**, users can install Vígadi from the browser:

| Platform | How to install |
|----------|----------------|
| **Android (Chrome)** | Menu → *Install app* or the install banner |
| **iPhone (Safari)** | Share → *Add to Home Screen* |
| **Desktop (Chrome/Edge)** | Address bar install icon |

The app includes:

- `manifest.webmanifest` (name, icons, theme colors)
- Service worker (offline shell + cached assets)
- Standalone display mode (full-screen, no browser chrome)

---

## Before you deploy

1. **Gemini API key** — create at [Google AI Studio](https://aistudio.google.com/apikey)
2. **GitHub repo** — push this project to GitHub (already at `ManiAdhav/vigadi`)
3. **Rotate your API key** if it was ever shared in chat or commits

---

## Option A — Render (recommended, easiest)

Render runs the included `Dockerfile` and mounts a persistent disk for your dish catalog database.

### Steps

1. Go to [render.com](https://render.com) and sign in with GitHub
2. **New → Blueprint** (or **New Web Service**)
3. Connect repo `ManiAdhav/vigadi`, branch `cursor/pwa-host-deploy-d584` (or `main` after merge)
4. If using Blueprint, Render reads `render.yaml` automatically
5. Set environment variable:
   - `GEMINI_API_KEY` = your key
6. Deploy

### After deploy

- Open your URL: `https://vigadi-xxxx.onrender.com`
- On mobile, use *Add to Home Screen* / *Install app*
- First dish discovery per ingredient is slow; later visits use the local DB cache

### Notes

- **Starter plan** ($7/mo) is needed for the persistent disk in `render.yaml`
- Free tier sleeps after inactivity (cold starts ~30s)

---

## Option B — Railway

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
2. Select the `vigadi` repo
3. Railway detects the `Dockerfile`
4. Add variables:
   - `GEMINI_API_KEY`
   - `NODE_ENV` = `production`
5. Add a **Volume** mounted at `/app/data` (1 GB) so SQLite persists
6. Deploy

---

## Option C — Fly.io

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly launch --no-deploy
fly secrets set GEMINI_API_KEY=your_key_here
fly volumes create vigadi_data --size 1
# Add to fly.toml:
# [mounts]
#   source = "vigadi_data"
#   destination = "/app/data"
fly deploy
```

---

## Option D — Google Cloud Run

Matches the original AI Studio deployment path.

```bash
gcloud run deploy vigadi \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets GEMINI_API_KEY=gemini-key:latest \
  --add-volume name=vigadi-data,type=cloud-storage,bucket=YOUR_BUCKET \
  --add-volume-mount volume=vigadi-data,mount-path=/app/data
```

Cloud Run needs extra setup for SQLite persistence (Cloud Storage FUSE or use a managed DB later).

---

## Option E — Self-host (VPS / home server)

```bash
git clone https://github.com/ManiAdhav/vigadi.git
cd vigadi
cp .env.example .env.local
# Edit .env.local — set GEMINI_API_KEY

npm install
npm run build
NODE_ENV=production PORT=3000 npm start
```

Put **Caddy** or **Nginx** in front with HTTPS (required for PWA install):

```caddy
vigadi.yourdomain.com {
    reverse_proxy localhost:3000
}
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes (for live YouTube discovery) | Google Gemini API key |
| `NODE_ENV` | Production | Set to `production` |
| `PORT` | Auto-set by host | Default `3000` |
| `APP_URL` | Optional | Public URL of your deployment |

---

## Verify PWA after deploy

1. Open Chrome DevTools → **Application** tab
2. Check **Manifest** loads with name *Vígadi*
3. Check **Service workers** is registered
4. Run [Lighthouse](https://developer.chrome.com/docs/lighthouse) → Progressive Web App audit
5. On phone: install to home screen and open standalone

---

## Local production test

```bash
npm run preview
# Opens http://localhost:3000 in production mode
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Install prompt missing | Site must be HTTPS; manifest + service worker must load |
| API errors on host | Set `GEMINI_API_KEY` in host environment |
| Dish catalog resets | Mount persistent volume at `/app/data` |
| Build fails on SQLite | Use the provided `Dockerfile` (includes build tools) |
| Cold start slow | Normal on free tiers; upgrade or use a keep-warm ping |

---

## Custom domain

On Render/Railway/Fly: add your domain in the dashboard, update DNS CNAME, wait for SSL. PWA install works automatically once HTTPS is active.
