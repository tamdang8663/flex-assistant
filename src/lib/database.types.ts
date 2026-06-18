/**
 * database.types.ts
 *
 * TypeScript types that mirror the Supabase schema defined in supabase/schema.sql.
 *
 * In a real project you'd generate these automatically with:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
 *
 * For now they're hand-written to match schema.sql exactly.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      gate_codes: {
        Row: {
          id: number;
          address: string;
          gate_code: string;
          note: string;
          status: "Working" | "Broken";
          created_at: string;
        };
        Insert: {
          id?: never; // bigserial — auto-generated
          address: string;
          gate_code: string;
          note?: string;
          status?: "Working" | "Broken";
          created_at?: never; // default now()
        };
        Update: {
          // Only status can be updated (Working ↔ Broken)
          status?: "Working" | "Broken";
        };
      };
    };
    Functions: {
      search_gate_codes: {
        Args: { query: string; max_rows?: number };
        Returns: Database["public"]["Tables"]["gate_codes"]["Row"][];
      };
    };
  };
}

// Convenience alias
export type GateCodeRow = Database["public"]["Tables"]["gate_codes"]["Row"];
export type GateCodeInsert = Database["public"]["Tables"]["gate_codes"]["Insert"];
