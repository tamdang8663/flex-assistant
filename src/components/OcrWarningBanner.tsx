"use client";

interface OcrWarningBannerProps {
  warnings: string[];
}

/**
 * Displayed after OCR if any extracted addresses look incomplete or suspicious.
 * Heuristics: very short, no digits, no state abbreviation, all caps fragment, etc.
 */
export default function OcrWarningBanner({ warnings }: OcrWarningBannerProps) {
  if (warnings.length === 0) return null;

  return (
    <div
      role="alert"
      style={{
        background: "var(--amber-lt)",
        border: "1px solid var(--amber)",
        borderRadius: "var(--radius)",
        padding: "12px 14px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>🔍</span>
      <div>
        <p style={{
          fontSize: 13, fontWeight: 700, color: "var(--amber-dk)",
          margin: "0 0 6px",
        }}>
          Review these {warnings.length} address{warnings.length !== 1 ? "es" : ""} — OCR may be incomplete
        </p>
        <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
          {warnings.map((w, i) => (
            <li key={i} style={{ fontSize: 12, color: "var(--amber-dk)", marginBottom: 3 }}>
              {w}
            </li>
          ))}
        </ul>
        <p style={{ fontSize: 12, color: "var(--amber-dk)", marginTop: 8, opacity: 0.8 }}>
          Tip: upload a clearer, brighter screenshot for best results.
        </p>
      </div>
    </div>
  );
}

/**
 * Run heuristics on OCR-extracted addresses and return any that look suspicious.
 * Call this client-side after receiving addresses from /api/ocr.
 */
export function detectLowConfidenceAddresses(addresses: string[]): string[] {
  return addresses.filter((a) => {
    const trimmed = a.trim();
    // Too short to be a real address
    if (trimmed.length < 10) return true;
    // No digits at all (street number missing)
    if (!/\d/.test(trimmed)) return true;
    // Looks like a fragment — no comma and very short
    if (!trimmed.includes(",") && trimmed.split(" ").length < 3) return true;
    // All uppercase fragment (often OCR noise)
    if (trimmed === trimmed.toUpperCase() && trimmed.length < 20) return true;
    // Ends mid-word (truncated)
    if (/[a-z]$/.test(trimmed) && !/(st|ave|rd|dr|blvd|ln|ct|way|pl|cir|loop)$/i.test(trimmed)) {
      // Only warn if it's very short
      if (trimmed.length < 15) return true;
    }
    return false;
  });
}
