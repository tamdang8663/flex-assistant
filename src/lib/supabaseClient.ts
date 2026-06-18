/**
 * supabaseClient.ts
 *
 * BROWSER-SAFE client — uses the anon (public) key.
 * The anon key is intentionally public; Row Level Security controls
 * what operations are allowed (select + insert only, no update/delete).
 *
 * Used by client components that need to read gate codes directly
 * (e.g. the gate code search page for instant results).
 *
 * For writes, all operations go through server API routes instead,
 * so input validation and duplicate-checking happen on the server.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton
let _client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseClient() {
  if (!_client) {
    _client = createClient<Database>(url, anonKey, {
      auth: { persistSession: false },
    });
  }
  return _client;
}
