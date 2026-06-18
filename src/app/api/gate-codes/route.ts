/**
 * GET /api/gate-codes
 *
 * Returns all gate codes ordered by created_at DESC.
 * Used by the gate codes page on initial load.
 *
 * Query params:
 *   limit  number  Max rows to return (default 200)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { GateCodeSearchResponse } from "@/lib/types";

export async function GET(
  req: NextRequest
): Promise<NextResponse<GateCodeSearchResponse>> {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "200"), 500);

    const { data, error } = await supabaseServer
      .from("gate_codes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (err) {
    console.error("[GET /api/gate-codes] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Database error" },
      { status: 500 }
    );
  }
}
