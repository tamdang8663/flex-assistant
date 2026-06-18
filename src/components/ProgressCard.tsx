"use client";

interface ProgressCardProps {
  message: string;
  sub?: string;
  pct: number; // 0–100
}

export default function ProgressCard({ message, sub, pct }: ProgressCardProps) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 16,
      }}
    >
      <p
        style={{
          fontSize: 14,
          color: "var(--text-2)",
          margin: "0 0 10px",
          textAlign: "center",
        }}
      >
        {message}
      </p>
      <div
        style={{
          height: 5,
          background: "var(--border)",
          borderRadius: 3,
          overflow: "hidden",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--amber)",
            borderRadius: 3,
            transition: "width .35s ease",
          }}
        />
      </div>
      {sub && (
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, textAlign: "center" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
