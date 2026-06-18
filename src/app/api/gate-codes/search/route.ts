/**
 * POST /api/gate-codes/search
 *
 * Improved search — matches on:
 *   - Full address (partial, case-insensitive)
 *   - Street number alone (e.g. "1234")
 *   - Gate code value (e.g. "#5678")
 *   - Fuzzy address similarity (pg_trgm)
 *
 * Also supports bulk lookup: { addresses: string[] }
 * Used by route page to check all OCR addresses at once.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { GateCode, GateCodeSearchResponse } from "@/lib/types";

export async function POST(
  req: NextRequest
): Promise<NextResponse<GateCodeSearchResponse>> {
  try {
    const body = await req.json();

    // ── Bulk address lookup (Route page after OCR) ─────────────────────────
    if ("addresses" in body && Array.isArray(body.addresses)) {
      const addresses: string[] = (body.addresses as string[]).slice(0, 150);
      if (addresses.length === 0) return NextResponse.json({ ok: true, data: [] });

      const streetPortions = addresses.map((a) =>
        a.split(",")[0].trim().toLowerCase()
      );
      const orFilter = streetPortions.map((s) => `address.ilike.%${s}%`).join(",");

      const { data, error } = await supabaseServer
        .from("gate_codes")
        .select("*")
        .or(orFilter)
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw error;
      return NextResponse.json({ ok: true, data: data ?? [] });
    }

    // ── Single search (Gate Codes page search bar) ─────────────────────────
    const query = ((body.query as string) ?? "").trim();
    const limit = Math.min(parseInt(body.limit ?? "50"), 100);

    if (!query) {
      const { data, error } = await supabaseServer
        .from("gate_codes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return NextResponse.json({ ok: true, data: data ?? [] });
    }

    // Build a multi-field OR filter:
    //   address ILIKE %query%   OR   gate_code ILIKE %query%
    // This lets drivers search by partial address OR by code value.
    const multiFilter = `address.ilike.%${query}%,gate_code.ilike.%${query}%`;

    const { data: ilikeData, error: ilikeError } = await supabaseServer
      .from("gate_codes")
      .select("*")
      .or(multiFilter)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!ilikeError && ilikeData && ilikeData.length > 0) {
      return NextResponse.json({ ok: true, data: ilikeData });
    }

    // Fuzzy fallback via pg_trgm RPC — catches typos and partial street names
    const { data: fuzzyData, error: fuzzyError } = await supabaseServer.rpc(
      "search_gate_codes",
      { query, max_rows: limit }
    );

    if (fuzzyError) {
      // pg_trgm not installed — plain ILIKE is the best we can do
      return NextResponse.json({
        ok: true,
        data: (ilikeData as GateCode[]) ?? [],
      });
    }

    return NextResponse.json({ ok: true, data: (fuzzyData as GateCode[]) ?? [] });
  } catch (err) {
    console.error("[POST /api/gate-codes/search] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Database error" },
      { status: 500 }
    );
  }
}
