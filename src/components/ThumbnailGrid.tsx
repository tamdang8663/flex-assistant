"use client";

export type ThumbStatus = "ready" | "scanning" | "done" | "error";

export interface ThumbFile {
  file: File;
  previewUrl: string;
  status: ThumbStatus;
}

const STATUS_LABEL: Record<ThumbStatus, string> = {
  ready:    "Ready",
  scanning: "Scanning…",
  done:     "✓ Done",
  error:    "✗ Error",
};

const STATUS_BG: Record<ThumbStatus, string> = {
  ready:    "rgba(0,0,0,.50)",
  scanning: "rgba(239,159,39,.90)",
  done:     "rgba(29,158,117,.90)",
  error:    "rgba(226,75,74,.90)",
};

const STATUS_COLOR: Record<ThumbStatus, string> = {
  ready:    "#fff",
  scanning: "#111",
  done:     "#fff",
  error:    "#fff",
};

interface ThumbnailGridProps {
  thumbs: ThumbFile[];
}

export default function ThumbnailGrid({ thumbs }: ThumbnailGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8,
      }}
    >
      {thumbs.map((t, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            aspectRatio: "9 / 16",
            borderRadius: 10,
            overflow: "hidden",
            background: "var(--bg)",
            border: "1px solid var(--border)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={t.previewUrl}
            alt={`Screenshot ${i + 1}`}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <span
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "4px 6px",
              fontSize: 10,
              fontWeight: 700,
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              background: STATUS_BG[t.status],
              color: STATUS_COLOR[t.status],
            }}
          >
            {STATUS_LABEL[t.status]}
          </span>
        </div>
      ))}
    </div>
  );
}
