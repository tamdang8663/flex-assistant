# Flex Assistant 🚐

Mobile-first web app for Amazon Flex drivers — screenshot OCR, route analysis, and a shared gate code database.

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # → http://localhost:3000
```

See **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)** and **[docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md)** for full setup guides.

---

## Features

| Feature | Description |
|---------|-------------|
| 📷 Route OCR | Upload itinerary screenshots → AI extracts all delivery addresses |
| 📊 Route Analysis | Total stops, miles, drive time, estimated finish |
| 🔒 Gate Code DB | Shared Supabase database of gate codes — search, add, toggle status |
| 📥 Import | Bulk-upload gate code screenshots → AI extracts address + code |
| 📋 Copy buttons | Copy address or gate code to clipboard in one tap |
| 🗺️ Maps button | Open any address in Google Maps |
| ⚠️ OCR Warnings | Flags low-confidence results for driver review |
| 📊 Dashboard | Total codes, working vs broken, reliability score |

---

## Tech Stack

- **Next.js 15** — React framework, App Router, API routes
- **TypeScript** — end-to-end type safety
- **Tailwind CSS** — utility-first styling
- **Supabase** — Postgres database, Row Level Security
- **Anthropic Claude** — screenshot OCR (vision)
- **Vercel** — deployment and edge functions

---

## Security Model

| Key | Lives where | Browser sees it? |
|-----|------------|-----------------|
| `ANTHROPIC_API_KEY` | Server env | ❌ Never |
| `SUPABASE_SERVICE_ROLE_KEY` | Server env | ❌ Never |
| `GOOGLE_MAPS_API_KEY` | Server env | ❌ Never |
| `ORS_API_KEY` | Server env | ❌ Never |
| `NEXT_PUBLIC_SUPABASE_URL` | Client bundle | ✅ Safe (by design) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client bundle | ✅ Safe (RLS protected) |

All Claude calls go through `/api/ocr`. All routing calls go through `/api/route-analysis`. The browser receives only JSON responses.

---

## Project Structure

```
flex-assistant/
├── docs/
│   ├── VERCEL_DEPLOYMENT.md   ← Step-by-step Vercel guide
│   └── SUPABASE_SETUP.md      ← Step-by-step Supabase guide
├── supabase/
│   └── schema.sql             ← Run this in Supabase SQL Editor
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ocr/           ← Claude vision OCR
│   │   │   ├── route-analysis/← Distance + gate code lookup
│   │   │   └── gate-codes/
│   │   │       ├── route.ts   ← GET all codes
│   │   │       ├── add/       ← POST one code
│   │   │       ├── search/    ← POST text + bulk lookup
│   │   │       ├── status/    ← PATCH Working/Broken
│   │   │       ├── bulk-add/  ← POST import many
│   │   │       └── stats/     ← GET dashboard counts
│   │   ├── dashboard/         ← Stats overview page
│   │   ├── gate-codes/        ← Search + manage codes
│   │   ├── import-gates/      ← Import from screenshots
│   │   ├── route/             ← OCR + route analysis
│   │   ├── layout.tsx
│   │   ├── page.tsx           ← Home
│   │   └── globals.css
│   ├── components/
│   │   ├── AddGateCodeModal.tsx
│   │   ├── AppHeader.tsx
│   │   ├── BottomNav.tsx
│   │   ├── ErrorBanner.tsx    ← Reusable error display
│   │   ├── OcrWarningBanner.tsx← Low-confidence OCR warnings
│   │   ├── ProgressCard.tsx
│   │   ├── RouteAnalysisDashboard.tsx
│   │   ├── SkeletonList.tsx   ← Loading placeholders
│   │   ├── ThumbnailGrid.tsx
│   │   ├── Toast.tsx
│   │   └── UploadZone.tsx
│   └── lib/
│       ├── database.types.ts
│       ├── gateStorage.ts     ← (legacy, kept for reference)
│       ├── routeAnalysis.ts
│       ├── supabaseClient.ts
│       ├── supabaseServer.ts
│       └── types.ts
├── .env.example               ← Copy to .env.local
├── next.config.ts
└── package.json
```

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/ocr` | POST | Claude vision — route or gate mode |
| `/api/route-analysis` | POST | Distance + time + gate code lookup |
| `/api/gate-codes` | GET | List all gate codes |
| `/api/gate-codes/add` | POST | Add one gate code |
| `/api/gate-codes/search` | POST | Search by address/code (single or bulk) |
| `/api/gate-codes/status` | PATCH | Toggle Working/Broken |
| `/api/gate-codes/bulk-add` | POST | Import many, skip duplicates |
| `/api/gate-codes/stats` | GET | Aggregate counts for dashboard |
