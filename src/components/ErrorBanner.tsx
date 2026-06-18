"use client";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: "var(--danger-lt)",
        border: "1px solid var(--danger)",
        borderRadius: "var(--radius)",
        padding: "12px 14px",
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, color: "var(--danger)", fontWeight: 500, margin: 0 }}>
          {message}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: 8,
              padding: "6px 14px",
              background: "none",
              border: "1px solid var(--danger)",
              borderRadius: "var(--radius-sm)",
              color: "var(--danger)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            ↺ Try again
          </button>
        )}
      </div>
    </div>
  );
}
