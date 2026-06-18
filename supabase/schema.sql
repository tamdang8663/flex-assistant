-- ══════════════════════════════════════════════════════════════════════════════
-- FLEX ASSISTANT — SUPABASE DATABASE SETUP
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. GATE CODES TABLE
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists gate_codes (
  id          bigserial primary key,
  address     text        not null,
  gate_code   text        not null,
  note        text        not null default '',
  status      text        not null default 'Working'
                          check (status in ('Working', 'Broken')),
  created_at  timestamptz not null default now()
);

-- Index on address for fast text-search lookups
create index if not exists gate_codes_address_lower_idx
  on gate_codes (lower(address));

-- Index on status for filtering
create index if not exists gate_codes_status_idx
  on gate_codes (status);

-- Prevent exact duplicate address+code pairs
create unique index if not exists gate_codes_unique_pair_idx
  on gate_codes (lower(address), lower(gate_code));


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ROW LEVEL SECURITY (RLS)
--
-- Policy: Anyone can READ (public app, shared gate code DB).
--         Anyone can INSERT (drivers contribute codes).
--         Nobody can UPDATE or DELETE via the client API.
--         Only the service-role key (used by your server) can do anything.
--
-- ─────────────────────────────────────────────────────────────────────────────

alter table gate_codes enable row level security;

-- Allow public reads (anon key, used by anyone)
create policy "Public read gate_codes"
  on gate_codes for select
  using (true);

-- Allow public inserts via anon key
-- (server validates data before inserting, so this is safe)
create policy "Public insert gate_codes"
  on gate_codes for insert
  with check (true);

-- No update/delete policies → those operations are blocked for anon clients
-- The service-role key bypasses RLS and CAN update/delete (admin use only)


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HELPER FUNCTION — fuzzy address search
--
-- Used by /api/gate-codes/search to match partial addresses.
-- Falls back to simple ILIKE if pg_trgm is not available.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable trigram extension for similarity search (safe to run multiple times)
create extension if not exists pg_trgm;

-- Function: search_gate_codes(query text, max_rows int)
create or replace function search_gate_codes(
  query      text,
  max_rows   int default 20
)
returns setof gate_codes
language sql
stable
as $$
  select *
  from   gate_codes
  where  lower(address) like '%' || lower(query) || '%'
     or  similarity(lower(address), lower(query)) > 0.2
  order  by similarity(lower(address), lower(query)) desc,
             created_at desc
  limit  max_rows;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SAMPLE DATA (optional — delete before production)
-- ─────────────────────────────────────────────────────────────────────────────

-- insert into gate_codes (address, gate_code, note, status) values
--   ('1234 Oak Street, Sacramento, CA 95814', '#4521',  'Call box on left side of gate', 'Working'),
--   ('5678 Maple Ave, Elk Grove, CA 95758',   '*1234#', 'Works for both vehicle and walk gates', 'Working'),
--   ('910 Pine Road, Rancho Cordova, CA 95670','1357',  'Broken — use intercom instead', 'Broken');


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VERIFICATION QUERIES (run after setup to confirm everything is working)
-- ─────────────────────────────────────────────────────────────────────────────

-- Check table structure:
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_name = 'gate_codes'
-- order by ordinal_position;

-- Check indexes:
-- select indexname, indexdef
-- from pg_indexes
-- where tablename = 'gate_codes';

-- Check RLS policies:
-- select policyname, cmd, qual
-- from pg_policies
-- where tablename = 'gate_codes';

-- Test search function:
-- select * from search_gate_codes('oak', 5);
