# Flex Assistant — Supabase Setup Guide

Complete step-by-step guide to setting up the Supabase database for Flex Assistant.

---

## Step 1 — Create a Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click **"New Project"**
3. Choose your organization (or create one — free)
4. Fill in:
   - **Name:** `flex-assistant` (or anything you like)
   - **Database Password:** Generate a strong one and save it somewhere
   - **Region:** Choose closest to your drivers (e.g. `us-west-1` for California)
5. Click **"Create new project"**
6. Wait ~2 minutes for provisioning

---

## Step 2 — Run the Database Schema

1. In the Supabase sidebar, click **"SQL Editor"**
2. Click **"New query"**
3. Copy and paste the entire contents of `supabase/schema.sql`
4. Click **"Run"** (or press `Ctrl+Enter` / `Cmd+Enter`)

You should see: `Success. No rows returned`

### What the schema creates

```sql
-- Main table
gate_codes (
  id         bigserial PRIMARY KEY,
  address    text NOT NULL,
  gate_code  text NOT NULL,
  note       text NOT NULL DEFAULT '',
  status     text NOT NULL DEFAULT 'Working'  -- 'Working' | 'Broken'
             CHECK (status IN ('Working', 'Broken')),
  created_at timestamptz NOT NULL DEFAULT now()
)

-- Indexes (auto-created by schema.sql)
gate_codes_address_lower_idx    -- fast text search
gate_codes_status_idx           -- filter by status
gate_codes_unique_pair_idx      -- prevents duplicate address+code pairs

-- Row Level Security
Public:  SELECT ✅  INSERT ✅  UPDATE ❌  DELETE ❌
Service: SELECT ✅  INSERT ✅  UPDATE ✅  DELETE ✅

-- SQL function
search_gate_codes(query, max_rows)  -- fuzzy address matching
```

### Verify the schema

Run this in the SQL Editor to confirm everything was created:

```sql
-- Check table
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'gate_codes'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'gate_codes';

-- Check RLS policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'gate_codes';

-- Test search function
SELECT * FROM search_gate_codes('main street', 3);
```

---

## Step 3 — Get Your API Keys

In the Supabase dashboard:

**Settings → API**

Copy these three values into your `.env.local`:

### Project URL
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
```

### Anon / Public key
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
This key is safe to expose publicly. Row Level Security controls access.

### Service Role key (SECRET)
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
**Never commit this to Git.** It bypasses all Row Level Security.

---

## Step 4 — Verify the Connection

Start your dev server and open the app:

```bash
npm run dev
```

Go to `http://localhost:3000/dashboard` — you should see:

```
Gate Code Database
Total Gate Codes: 0
✅ Working: 0
❌ Broken: 0
Added This Week: 0
```

If you see an error instead, check your `.env.local` values.

---

## Row Level Security Explained

Flex Assistant uses Supabase's Row Level Security (RLS) as the access control layer.

### What the anon key can do
- **Read** all gate codes (any driver can look up any code)
- **Insert** new gate codes (any driver can contribute)

### What the anon key cannot do
- **Update** gate codes (no editing addresses or codes once saved)
- **Delete** gate codes (no deletion from the app UI)

### What only the service role key can do
- **Update** gate codes (status toggle goes through `/api/gate-codes/status`, which uses the service key server-side)
- **Delete** gate codes (admin-only, not exposed in the app UI)

This means even if someone inspects the browser network traffic and finds the Supabase URL + anon key, they can only read and insert — they cannot edit or delete gate codes.

---

## Database Maintenance

### Add sample data (optional)
```sql
INSERT INTO gate_codes (address, gate_code, note, status) VALUES
  ('1234 Oak Street, Sacramento, CA 95814', '#4521',  'Call box on left side of gate', 'Working'),
  ('5678 Maple Ave, Elk Grove, CA 95758',   '*1234#', 'Both vehicle and walk gates',  'Working'),
  ('910 Pine Road, Rancho Cordova, CA 95670','1357',  'Broken — use intercom instead', 'Broken');
```

### View all gate codes
```sql
SELECT * FROM gate_codes ORDER BY created_at DESC LIMIT 50;
```

### Find broken codes
```sql
SELECT * FROM gate_codes WHERE status = 'Broken' ORDER BY created_at DESC;
```

### Delete a specific gate code (admin only — run in SQL Editor)
```sql
DELETE FROM gate_codes WHERE id = 123;
```

### Reset all data (DANGER — irreversible)
```sql
TRUNCATE TABLE gate_codes RESTART IDENTITY;
```

---

## Backup

Supabase automatically backs up your database daily on all plans.

For manual backup:
**Settings → Database → Backups → Download**

Or use `pg_dump` with your connection string from **Settings → Database → Connection string**.

---

## Upgrading to Supabase Pro (Optional)

The free tier includes:
- 500 MB database
- 2 GB bandwidth
- Unlimited API requests
- Daily backups

For a fleet of drivers adding hundreds of gate codes, the free tier is more than sufficient. Upgrade to Pro ($25/mo) if you need:
- Point-in-time recovery
- More than 500 MB storage
- Custom domain for the Supabase API
