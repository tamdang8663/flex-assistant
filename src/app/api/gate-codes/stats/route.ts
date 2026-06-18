/**
 * GET /api/gate-codes/stats
 *
 * Returns aggregate counts for the dashboard:
 *   - total gate codes
 *   - working count
 *   - broken count
 *   - added in last 7 days
 */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { GateCodeStatsResponse } from "@/lib/types";

export async function GET(): Promise<NextResponse<GateCodeStatsResponse>> {
  try {
    // Run all counts in parallel
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const [totalRes, workingRes, brokenRes, recentRes] = await Promise.all([
      supabaseServer.from("gate_codes").select("*", { count: "exact", head: true }),
      supabaseServer
        .from("gate_codes")
        .select("*", { count: "exact", head: true })
        .eq("status", "Working"),
      supabaseServer
        .from("gate_codes")
        .select("*", { count: "exact", head: true })
        .eq("status", "Broken"),
      supabaseServer
        .from("gate_codes")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        total: totalRes.count ?? 0,
        working: workingRes.count ?? 0,
        broken: brokenRes.count ?? 0,
        recentlyAdded: recentRes.count ?? 0,
      },
    });
  } catch (err) {
    console.error("[GET /api/gate-codes/stats] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Database error",
      },
      { status: 500 }
    );
  }
}
