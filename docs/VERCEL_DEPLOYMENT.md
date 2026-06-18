# Flex Assistant — Vercel Deployment Guide

Complete step-by-step guide to deploying Flex Assistant to production on Vercel.

---

## Prerequisites

- Node.js 18+ installed locally
- A [Vercel account](https://vercel.com) (free tier works)
- A [Supabase project](https://app.supabase.com) with the schema applied (see `SUPABASE_SETUP.md`)
- An [Anthropic API key](https://console.anthropic.com)

---

## Option A — Deploy via Vercel Dashboard (Recommended)

### Step 1 — Push to GitHub

```bash
cd flex-assistant
git init
git add .
git commit -m "Initial commit — Flex Assistant"
```

Create a new repository on GitHub, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/flex-assistant.git
git branch -M main
git push -u origin main
```

### Step 2 — Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select your `flex-assistant` repository
4. Framework will be auto-detected as **Next.js** ✓
5. Click **"Deploy"** — the first deploy will fail because env vars aren't set yet (that's fine)

### Step 3 — Set Environment Variables

In Vercel dashboard: **Project → Settings → Environment Variables**

Add each variable for **Production**, **Preview**, and **Development**:

| Name | Value | Notes |
|------|-------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Required — Claude OCR |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Required — keep secret |
| `GOOGLE_MAPS_API_KEY` | *(optional)* | Precise route distances |
| `ORS_API_KEY` | *(optional)* | Free routing fallback |

### Step 4 — Redeploy

After setting env vars:
1. Go to **Deployments** tab
2. Click the three dots **···** on the latest deployment
3. Click **"Redeploy"**

Your app is now live at `https://your-project.vercel.app` 🎉

---

## Option B — Deploy via CLI

### Install Vercel CLI

```bash
npm install -g vercel
```

### Login and deploy

```bash
cd flex-assistant
vercel login
vercel
```

Follow the prompts. When asked about settings, accept all defaults.

### Set environment variables via CLI

```bash
# Required
vercel env add ANTHROPIC_API_KEY
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Optional
vercel env add GOOGLE_MAPS_API_KEY
vercel env add ORS_API_KEY

# Deploy to production
vercel --prod
```

---

## Custom Domain (Optional)

1. Vercel dashboard → **Domains**
2. Add your domain (e.g. `flexassistant.app`)
3. Update your DNS at your registrar:
   - Add a `CNAME` record pointing to `cname.vercel-dns.com`
   - Or use Vercel's nameservers for automatic SSL

---

## Checking Your Deployment

### Health check URLs

After deploying, verify these endpoints respond:

```
GET  https://your-app.vercel.app/                      → Home page
POST https://your-app.vercel.app/api/ocr               → OCR endpoint
POST https://your-app.vercel.app/api/route-analysis    → Route analysis
GET  https://your-app.vercel.app/api/gate-codes/stats  → DB stats
```

### Test the OCR endpoint

```bash
curl -X POST https://your-app.vercel.app/api/ocr \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"iVBORw0KGgo=","mimeType":"image/png","mode":"route"}' \
  | python3 -m json.tool
```

Expected: `{"ok": false, "error": "..."}` (because it's a tiny test image — but it confirms the endpoint is live)

---

## Vercel Function Limits

| Tier | Max Duration | Max Payload |
|------|-------------|-------------|
| Hobby (free) | 10s | 4.5 MB |
| Pro | 300s | 4.5 MB |

> **Note:** The OCR endpoint sends large image data. If you're on the Hobby tier, large screenshots may time out. Upgrade to **Pro** ($20/mo) if drivers report scan failures on complex images.

The body parser limit is set to 20 MB in `next.config.ts`, but Vercel's network limit is 4.5 MB per request on all tiers. Screenshots compressed by iOS/Android are typically 1–3 MB, so this should be fine in practice.

---

## Environment Variables Reference

| Variable | Required | Exposed to browser | Description |
|----------|----------|-------------------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | ❌ Server only | Claude OCR |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ Safe (RLS protected) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ Safe (RLS protected) | Public Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ❌ Server only | Admin Supabase key |
| `GOOGLE_MAPS_API_KEY` | ⬜ | ❌ Server only | Distance Matrix API |
| `ORS_API_KEY` | ⬜ | ❌ Server only | OpenRouteService |

Variables prefixed with `NEXT_PUBLIC_` are embedded in the client bundle. Only use this prefix for values safe to be public (Supabase anon key is designed to be public — Row Level Security is the access control mechanism).

---

## Monitoring & Logs

- **Function logs:** Vercel dashboard → **Functions** tab → click any invocation
- **Error tracking:** Consider adding [Sentry](https://sentry.io) for production error monitoring
- **Supabase logs:** [Supabase dashboard](https://app.supabase.com) → **Logs** → API Logs

---

## Re-deployment Workflow

After making code changes:

```bash
git add .
git commit -m "describe your change"
git push origin main
```

Vercel automatically deploys every push to `main`. Preview deployments are created for every pull request.
