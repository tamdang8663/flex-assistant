/**
 * supabaseServer.ts
 *
 * SERVER-SIDE ONLY — never import this in client components.
 * Uses the SERVICE_ROLE key which bypasses Row Level Security.
 * This client is used by API routes for all database operations.
 *
 * The anon key is used by supabaseClient.ts (browser) for read-only ops.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "Missing Supabase environment variables.\n" +
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
}

// Singleton — reuse across hot-reloads in dev
const globalForSupabase = globalThis as unknown as {
  _supabaseServer: ReturnType<typeof createClient<Database>> | undefined;
};

export const supabaseServer =
  globalForSupabase._supabaseServer ??
  createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });

if (process.env.NODE_ENV !== "production") {
  globalForSupabase._supabaseServer = supabaseServer;
}
