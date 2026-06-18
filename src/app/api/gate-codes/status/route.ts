/**
 * PATCH /api/gate-codes/status
 *
 * The ONLY mutation allowed on existing records.
 * Drivers can toggle a gate code between "Working" and "Broken".
 *
 * No edit, no delete — those operations are admin-only (service-role key only).
 *
 * Body: GateCodeStatusRequest  { id: number, status: "Working" | "Broken" }
 * Returns: GateCodeStatusResponse
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { GateCodeStatusRequest, GateCodeStatusResponse } from "@/lib/types";

export async function PATCH(
  req: NextRequest
): Promise<NextResponse<GateCodeStatusResponse>> {
  try {
    const body = (await req.json()) as GateCodeStatusRequest;
    const { id, status } = body;

    if (!id || typeof id !== "number") {
      return NextResponse.json(
        { ok: false, error: "id (number) is required" },
        { status: 400 }
      );
    }

    if (!["Working", "Broken"].includes(status)) {
      return NextResponse.json(
        { ok: false, error: 'status must be "Working" or "Broken"' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("gate_codes")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { ok: false, error: `Gate code with id ${id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[PATCH /api/gate-codes/status] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Database error" },
      { status: 500 }
    );
  }
}
