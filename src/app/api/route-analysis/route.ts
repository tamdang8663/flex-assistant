/**
 * POST /api/route-analysis
 *
 * Receives extracted addresses and computes route stats + gate code matches.
 * Runs route distance calc and Supabase gate lookup in parallel.
 * All API keys stay server-side.
 *
 * Body: RouteAnalysisRequest
 * Returns: RouteAnalysisResponse + stops array with per-stop gate code data
 */

import { NextRequest, NextResponse } from "next/server";
import { analyseRoute } from "@/lib/routeAnalysis";
import { supabaseServer } from "@/lib/supabaseServer";
import type {
  GateCode,
  RouteAnalysisRequest,
  RouteAnalysisResponse,
  RouteStopWithGate,
} from "@/lib/types";

export async function POST(
  req: NextRequest
): Promise<NextResponse<RouteAnalysisResponse & { stops?: RouteStopWithGate[] }>> {
  try {
    const body = (await req.json()) as RouteAnalysisRequest;
    const { addresses, startTime } = body;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { ok: false, error: "addresses array is required and must not be empty" },
        { status: 400 }
      );
    }

    const capped = addresses.slice(0, 150);

    // Build OR filter for Supabase gate code lookup
    const streetPortions = capped.map((a) =>
      a.split(",")[0].trim().toLowerCase()
    );
    const orFilter = streetPortions.map((s) => `address.ilike.%${s}%`).join(",");

    // Run route analysis and gate code lookup in parallel
    const [routeResult, gateResult] = await Promise.allSettled([
      analyseRoute(capped, [], startTime),
      supabaseServer
        .from("gate_codes")
        .select("*")
        .or(orFilter)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const routeData =
      routeResult.status === "fulfilled"
        ? routeResult.value
        : await analyseRoute(capped, [], startTime);

    const gateRows: GateCode[] =
      gateResult.status === "fulfilled" && !gateResult.value.error
        ? (gateResult.value.data as GateCode[]) ?? []
        : [];

    // Match each stop to the best gate code match
    const stopsWithGates: RouteStopWithGate[] = capped.map((addr) => {
      const addrStreet = addr.split(",")[0].trim().toLowerCase();
      const match = gateRows.find((g) => {
        const gStreet = g.address.split(",")[0].trim().toLowerCase();
        return gStreet.includes(addrStreet) || addrStreet.includes(gStreet);
      });
      return { address: addr, gateCode: match ?? null };
    });

    const gateCodesFound = stopsWithGates.filter((s) => s.gateCode !== null).length;

    return NextResponse.json({
      ok: true,
      data: { ...routeData, gateCodesFound },
      stops: stopsWithGates,
    });
  } catch (err) {
    console.error("[/api/route-analysis] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
