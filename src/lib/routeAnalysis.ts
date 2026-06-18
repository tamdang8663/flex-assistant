/**
 * Route analysis — three-tier strategy:
 *   1. Google Maps Distance Matrix API  (if GOOGLE_MAPS_API_KEY set)
 *   2. OpenRouteService Matrix API      (if ORS_API_KEY set)
 *   3. Pure heuristic estimate          (always available, no API needed)
 *
 * All distance math is server-side only; keys never reach the browser.
 */

import type { RouteAnalysisResult } from "./types";

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const ORS_KEY = process.env.ORS_API_KEY ?? "";

// Average assumptions for Amazon Flex urban/suburban deliveries
const AVG_SPEED_MPH = 20; // city driving with stops
const SERVICE_TIME_MIN = 2.5; // minutes per stop (park, scan, deliver)

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatFinishTime(startIso: string, addMinutes: number): string {
  const d = new Date(new Date(startIso).getTime() + addMinutes * 60_000);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function estimatedFinishIso(addMinutes: number): string {
  return new Date(Date.now() + addMinutes * 60_000).toISOString();
}

// ── Strategy 1: Google Maps Distance Matrix ───────────────────────────────────

async function analyseWithGoogle(
  addresses: string[]
): Promise<{ totalMiles: number; totalKm: number; drivingTimeMinutes: number } | null> {
  if (!GOOGLE_KEY) return null;

  try {
    // Build origin-destination pairs for sequential stops
    // Google DM supports up to 25 origins × 25 destinations per request.
    // For >25 stops we chunk into sequential pairs (origin → next destination).
    let totalMetres = 0;
    let totalSeconds = 0;

    for (let i = 0; i < addresses.length - 1; i++) {
      const origin = encodeURIComponent(addresses[i]);
      const dest = encodeURIComponent(addresses[i + 1]);
      const url =
        `https://maps.googleapis.com/maps/api/distancematrix/json` +
        `?origins=${origin}&destinations=${dest}` +
        `&units=imperial&key=${GOOGLE_KEY}`;

      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      const element = data?.rows?.[0]?.elements?.[0];
      if (element?.status === "OK") {
        totalMetres += element.distance.value;
        totalSeconds += element.duration.value;
      }
    }

    const totalKm = totalMetres / 1000;
    const totalMiles = totalKm * 0.621371;
    const drivingTimeMinutes = totalSeconds / 60;
    return { totalMiles, totalKm, drivingTimeMinutes };
  } catch {
    return null;
  }
}

// ── Strategy 2: OpenRouteService Matrix ───────────────────────────────────────

async function geocodeWithNominatim(
  address: string
): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "FlexAssistant/1.0" },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data[0]) return null;
    return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
  } catch {
    return null;
  }
}

async function analyseWithORS(
  addresses: string[]
): Promise<{ totalMiles: number; totalKm: number; drivingTimeMinutes: number } | null> {
  if (!ORS_KEY) return null;

  try {
    // Geocode all addresses via Nominatim (free, no key)
    const coords: [number, number][] = [];
    for (const addr of addresses) {
      const c = await geocodeWithNominatim(addr);
      if (c) coords.push(c);
    }
    if (coords.length < 2) return null;

    // ORS Matrix API
    const url = "https://api.openrouteservice.org/v2/matrix/driving-car";
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: ORS_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locations: coords,
        metrics: ["distance", "duration"],
        units: "km",
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();

    // Sum sequential pairs from the matrix
    let totalKm = 0;
    let totalSeconds = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      totalKm += data.distances?.[i]?.[i + 1] ?? 0;
      totalSeconds += data.durations?.[i]?.[i + 1] ?? 0;
    }

    return {
      totalKm,
      totalMiles: totalKm * 0.621371,
      drivingTimeMinutes: totalSeconds / 60,
    };
  } catch {
    return null;
  }
}

// ── Strategy 3: Heuristic estimate ───────────────────────────────────────────

function heuristicEstimate(stopCount: number): {
  totalMiles: number;
  totalKm: number;
  drivingTimeMinutes: number;
} {
  // Reasonable Amazon Flex estimate: ~1.35 miles between sequential urban stops
  const totalMiles = stopCount * 1.35;
  const totalKm = totalMiles * 1.60934;
  const drivingTimeMinutes = (totalMiles / AVG_SPEED_MPH) * 60;
  return { totalMiles, totalKm, drivingTimeMinutes };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyseRoute(
  addresses: string[],
  gateCodeAddresses: string[] = [],
  startTimeOverride?: string
): Promise<RouteAnalysisResult> {
  const stopCount = addresses.length;

  // Try routing engines in priority order
  let routeData: {
    totalMiles: number;
    totalKm: number;
    drivingTimeMinutes: number;
  } | null = null;

  let source: RouteAnalysisResult["source"] = "estimate";

  if (GOOGLE_KEY) {
    routeData = await analyseWithGoogle(addresses);
    if (routeData) source = "google";
  }

  if (!routeData && ORS_KEY) {
    routeData = await analyseWithORS(addresses);
    if (routeData) source = "ors";
  }

  if (!routeData) {
    routeData = heuristicEstimate(stopCount);
    source = "estimate";
  }

  // Add service time per stop on top of driving time
  const serviceMinutes = stopCount * SERVICE_TIME_MIN;
  const totalMinutes = routeData.drivingTimeMinutes + serviceMinutes;

  const finishIso = estimatedFinishIso(totalMinutes);
  const startIso = startTimeOverride
    ? new Date(startTimeOverride).toISOString()
    : new Date().toISOString();
  const estimatedFinishFormatted = formatFinishTime(startIso, totalMinutes);

  // Build stop list with gate code flags
  const gateNorms = gateCodeAddresses.map((a) => a.toLowerCase().split(",")[0].trim());
  const stops = addresses.map((addr) => ({
    address: addr,
    hasGateCode: gateNorms.some((g) => {
      const a = addr.toLowerCase().split(",")[0].trim();
      return a.includes(g) || g.includes(a);
    }),
  }));

  const gateCodesFound = stops.filter((s) => s.hasGateCode).length;

  return {
    totalStops: stopCount,
    totalMiles: Math.round(routeData.totalMiles * 10) / 10,
    totalKm: Math.round(routeData.totalKm * 10) / 10,
    drivingTimeMinutes: Math.round(totalMinutes),
    drivingTimeFormatted: formatDuration(totalMinutes),
    estimatedFinish: finishIso,
    estimatedFinishFormatted,
    stops,
    gateCodesFound,
    source,
  };
}
