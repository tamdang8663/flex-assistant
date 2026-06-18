"use client";

interface SkeletonListProps {
  rows?: number;
}

export default function SkeletonList({ rows = 5 }: SkeletonListProps) {
  return (
    <div
      role="status"
      aria-label="Loading gate codes…"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "14px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            opacity: 1 - i * 0.12, // fade out toward bottom
          }}
        >
          {/* Lock icon placeholder */}
          <div
            className="skeleton"
            style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0 }}
          />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Address line */}
            <div
              className="skeleton"
              style={{ height: 13, borderRadius: 4, width: `${60 + (i % 3) * 12}%` }}
            />
            {/* Gate code line */}
            <div
              className="skeleton"
              style={{ height: 18, borderRadius: 4, width: `${28 + (i % 2) * 8}%` }}
            />
          </div>
          {/* Status badge placeholder */}
          <div
            className="skeleton"
            style={{ width: 56, height: 22, borderRadius: 99, flexShrink: 0 }}
          />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
