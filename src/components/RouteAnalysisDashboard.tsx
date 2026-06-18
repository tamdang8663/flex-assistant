"use client";

import type { RouteAnalysisResult } from "@/lib/types";

interface RouteAnalysisDashboardProps {
  result: RouteAnalysisResult;
}

const SOURCE_LABEL: Record<RouteAnalysisResult["source"], string> = {
  google:   "Powered by Google Maps",
  ors:      "Powered by OpenRouteService",
  estimate: "Estimated (add API key for precision)",
};

const SOURCE_COLOR: Record<RouteAnalysisResult["source"], string> = {
  google:   "var(--teal)",
  ors:      "var(--teal)",
  estimate: "var(--amber)",
};

export default function RouteAnalysisDashboard({
  result,
}: RouteAnalysisDashboardProps) {
  const stats = [
    { value: String(result.totalStops),            label: "Total Stops" },
    { value: `${result.totalMiles} mi`,            label: "Total Miles" },
    { value: result.drivingTimeFormatted,          label: "Drive Time" },
    { value: result.estimatedFinishFormatted,      label: "Est. Finish" },
  ];

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* ── Headline numbers ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {stats.map(({ value, label }) => (
          <div
            key={label}
            style={{
              background: "var(--bg)",
              borderRadius: "var(--radius-sm)",
              padding: "12px 14px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "var(--text-1)",
                lineHeight: 1.1,
              }}
            >
              {value}
            </div>
            <div
              style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Gate code match row ── */}
      {result.gateCodesFound > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--teal-lt)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 14px",
          }}
        >
          <span style={{ fontSize: 20 }}>🔒</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--teal-dk)" }}>
            {result.gateCodesFound} gate code
            {result.gateCodesFound !== 1 ? "s" : ""} found in your database
          </span>
        </div>
      )}

      {/* ── Data source badge ── */}
      <p
        style={{
          fontSize: 11,
          color: SOURCE_COLOR[result.source],
          textAlign: "center",
          margin: 0,
          fontWeight: 500,
        }}
      >
        {SOURCE_LABEL[result.source]}
      </p>
    </div>
  );
}
