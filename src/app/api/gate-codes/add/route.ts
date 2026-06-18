/**
 * POST /api/gate-codes/add
 *
 * Inserts a single gate code into Supabase.
 * Rejects exact duplicates (same address + same code, case-insensitive).
 *
 * Body: GateCodeAddRequest
 * Returns: GateCodeAddResponse
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { GateCodeAddRequest, GateCodeAddResponse } from "@/lib/types";

export async function POST(
  req: NextRequest
): Promise<NextResponse<GateCodeAddResponse>> {
  try {
    const body = (await req.json()) as GateCodeAddRequest;

    // ── Validate ──────────────────────────────────────────────────────────────
    const address = body.address?.trim();
    const gate_code = body.gate_code?.trim();
    const note = body.note?.trim() ?? "";
    const status = body.status ?? "Working";

    if (!address || !gate_code) {
      return NextResponse.json(
        { ok: false, error: "address and gate_code are required" },
        { status: 400 }
      );
    }

    if (!["Working", "Broken"].includes(status)) {
      return NextResponse.json(
        { ok: false, error: 'status must be "Working" or "Broken"' },
        { status: 400 }
      );
    }

    // ── Duplicate check ───────────────────────────────────────────────────────
    // The unique index on (lower(address), lower(gate_code)) will also catch
    // duplicates at the DB level, but checking first gives a nicer error.
    const { data: existing } = await supabaseServer
      .from("gate_codes")
      .select("id")
      .ilike("address", address)
      .ilike("gate_code", gate_code)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: false, duplicate: true, error: "Gate code already exists for this address" });
    }

    // ── Insert ────────────────────────────────────────────────────────────────
    const { data, error } = await supabaseServer
      .from("gate_codes")
      .insert({ address, gate_code, note, status })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[POST /api/gate-codes/add] error:", err);
    // Unique constraint violation from the DB
    if (
      err instanceof Object &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      return NextResponse.json({ ok: false, duplicate: true, error: "Duplicate entry" });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Database error" },
      { status: 500 }
    );
  }
}
