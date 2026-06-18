/**
 * POST /api/gate-codes/bulk-add
 *
 * Imports multiple gate codes at once (used by the Import page).
 * Silently skips exact duplicates (same address + code).
 * Returns how many were added vs skipped.
 *
 * Body: GateCodeBulkAddRequest  { entries: GateCodeAddRequest[] }
 * Returns: GateCodeBulkAddResponse
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type {
  GateCodeAddRequest,
  GateCodeBulkAddRequest,
  GateCodeBulkAddResponse,
} from "@/lib/types";

export async function POST(
  req: NextRequest
): Promise<NextResponse<GateCodeBulkAddResponse>> {
  try {
    const body = (await req.json()) as GateCodeBulkAddRequest;
    const rawEntries = body.entries;

    if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
      return NextResponse.json(
        { ok: false, added: 0, skipped: 0, error: "entries array is required" },
        { status: 400 }
      );
    }

    // Validate and normalise each entry
    const valid: GateCodeAddRequest[] = [];
    for (const e of rawEntries.slice(0, 50)) {
      const address = e.address?.trim();
      const gate_code = e.gate_code?.trim();
      if (address && gate_code) {
        valid.push({
          address,
          gate_code,
          note: e.note?.trim() ?? "",
          status: e.status ?? "Working",
        });
      }
    }

    if (valid.length === 0) {
      return NextResponse.json({ ok: true, added: 0, skipped: rawEntries.length });
    }

    // Fetch existing records that might match any of these addresses (bulk lookup)
    const orFilter = valid
      .map((e) => `address.ilike.%${e.address.split(",")[0].trim()}%`)
      .join(",");

    const { data: existingRows } = await supabaseServer
      .from("gate_codes")
      .select("address, gate_code")
      .or(orFilter);

    const existingSet = new Set(
      (existingRows ?? []).map(
        (r) => `${r.address.toLowerCase()}|||${r.gate_code.toLowerCase()}`
      )
    );

    // Filter out duplicates
    const toInsert = valid.filter(
      (e) =>
        !existingSet.has(
          `${e.address.toLowerCase()}|||${e.gate_code.toLowerCase()}`
        )
    );

    const skipped = valid.length - toInsert.length;

    if (toInsert.length === 0) {
      return NextResponse.json({ ok: true, added: 0, skipped });
    }

    // Insert all new records
    const { data, error } = await supabaseServer
      .from("gate_codes")
      .insert(
        toInsert.map((e) => ({
          address: e.address,
          gate_code: e.gate_code,
          note: e.note ?? "",
          status: e.status ?? "Working",
        }))
      )
      .select();

    if (error) {
      // If some were duplicates at DB level, still count what got in
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ ok: true, added: 0, skipped: valid.length });
      }
      throw error;
    }

    return NextResponse.json({
      ok: true,
      added: data?.length ?? toInsert.length,
      skipped,
    });
  } catch (err) {
    console.error("[POST /api/gate-codes/bulk-add] error:", err);
    return NextResponse.json(
      {
        ok: false,
        added: 0,
        skipped: 0,
        error: err instanceof Error ? err.message : "Database error",
      },
      { status: 500 }
    );
  }
}
