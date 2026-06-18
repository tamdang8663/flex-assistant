"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import UploadZone from "@/components/UploadZone";
import ThumbnailGrid, { ThumbFile } from "@/components/ThumbnailGrid";
import ProgressCard from "@/components/ProgressCard";
import ErrorBanner from "@/components/ErrorBanner";
import Toast, { useToast } from "@/components/Toast";
import type { OcrResponse } from "@/lib/types";

type Step = "upload" | "thumbs" | "scanning" | "review";

// One screenshot's extracted result
interface ScreenshotResult {
  address: string;
  codes: string[];       // all codes found in this screenshot
  warnings: string[];
  confidence: number;
}

// One row in the review list = one address + one code
interface ImportRow {
  address: string;
  code: string;
  confidence: number;
  selected: boolean;     // driver can deselect individual rows
}

async function importCodes(entries: { address: string; gate_code: string }[]): Promise<{ added: number; skipped: number }> {
  const res = await fetch("/api/gate-codes/bulk-add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entries: entries.map((e) => ({
        address: e.address,
        gate_code: e.gate_code,
        note: "",
        status: "Working",
      })),
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const d = await res.json();
  if (!d.ok) throw new Error(d.error ?? "Import failed");
  return { added: d.added, skipped: d.skipped };
}

function confidenceBadge(c: number): { label: string; color: string; bg: string } {
  if (c >= 80) return { label: `${c}% confident`, color: "var(--teal-dk)", bg: "var(--teal-lt)" };
  if (c >= 50) return { label: `${c}% — review`, color: "var(--amber-dk)", bg: "var(--amber-lt)" };
  return { label: `${c}% — low`, color: "var(--danger)", bg: "var(--danger-lt)" };
}

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep]           = useState<Step>("upload");
  const [thumbs, setThumbs]       = useState<ThumbFile[]>([]);
  const [progress, setProgress]   = useState({ pct: 0, msg: "Preparing…", sub: "" });
  const [scanError, setScanError] = useState("");
  const [allWarnings, setAllWarnings] = useState<string[]>([]);
  const [rows, setRows]           = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const { msg, show: showToast, clear } = useToast();

  const handleFiles = useCallback((files: File[]) => {
    setScanError("");
    setThumbs(files.map((f) => ({
      file: f, previewUrl: URL.createObjectURL(f), status: "ready" as const,
    })));
    setStep("thumbs");
  }, []);

  const reset = () => {
    thumbs.forEach((t) => URL.revokeObjectURL(t.previewUrl));
    setThumbs([]); setRows([]); setAllWarnings([]); setScanError("");
    setStep("upload");
  };

  // ── OCR scan ──────────────────────────────────────────────────────────────
  async function runOCR() {
    setScanError("");
    setStep("scanning");
    setProgress({ pct: 5, msg: "Reading screenshots…", sub: "" });

    const results: ScreenshotResult[] = [];
    const collectedWarnings: string[] = [];
    let failCount = 0;

    for (let i = 0; i < thumbs.length; i++) {
      const pct = Math.round(5 + (i / thumbs.length) * 85);
      setProgress({
        pct,
        msg: `Reading ${i + 1} of ${thumbs.length} screenshots…`,
        sub: thumbs[i].file.name,
      });
      setThumbs((p) => p.map((t, idx) =>
        idx === i ? { ...t, status: "scanning" as const } : t
      ));

      try {
        const b64 = await fileToBase64(thumbs[i].file);
        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: b64,
            mimeType: thumbs[i].file.type || "image/jpeg",
            mode: "gate",
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error((errData as { error?: string }).error ?? `HTTP ${res.status}`);
        }

        const data: OcrResponse = await res.json();

        if (data.ok && data.mode === "gate") {
          const { address, codes, confidence, warnings } = data.data;

          if (address && codes.length > 0) {
            results.push({ address, codes, confidence, warnings });
            collectedWarnings.push(...warnings);
            setThumbs((p) => p.map((t, idx) =>
              idx === i ? { ...t, status: "done" as const } : t
            ));
          } else {
            setThumbs((p) => p.map((t, idx) =>
              idx === i ? { ...t, status: "error" as const } : t
            ));
          }
        } else {
          setThumbs((p) => p.map((t, idx) =>
            idx === i ? { ...t, status: "error" as const } : t
          ));
        }
      } catch (err) {
        failCount++;
        console.error("Import OCR error", i, err);
        setThumbs((p) => p.map((t, idx) =>
          idx === i ? { ...t, status: "error" as const } : t
        ));
      }
    }

    if (results.length === 0 && failCount > 0) {
      setScanError("All screenshots failed to process. Check your connection and try again.");
    }

    // Flatten: one row per address×code combination, all pre-selected
    const flatRows: ImportRow[] = [];
    for (const r of results) {
      for (const code of r.codes) {
        flatRows.push({
          address: r.address,
          code,
          confidence: r.confidence,
          selected: true,
        });
      }
    }

    const totalCodes = flatRows.length;
    setProgress({ pct: 100, msg: `✓ Found ${totalCodes} gate code${totalCodes !== 1 ? "s" : ""}`, sub: "" });
    setRows(flatRows);
    setAllWarnings([...new Set(collectedWarnings)]); // dedup warnings
    setTimeout(() => setStep("review"), 500);
  }

  // ── Toggle individual row selection ───────────────────────────────────────
  const toggleRow = (i: number) => {
    setRows((prev) => prev.map((r, idx) =>
      idx === i ? { ...r, selected: !r.selected } : r
    ));
  };

  // ── Import selected rows ──────────────────────────────────────────────────
  const doImport = useCallback(async (selectedOnly: boolean) => {
    const toImport = selectedOnly ? rows.filter((r) => r.selected) : rows;
    if (toImport.length === 0) { showToast("⚠️ No codes selected"); return; }

    setImporting(true);
    try {
      const { added, skipped } = await importCodes(
        toImport.map((r) => ({ address: r.address, gate_code: r.code }))
      );
      const skipMsg = skipped > 0 ? ` (${skipped} duplicate${skipped !== 1 ? "s" : ""} skipped)` : "";
      showToast(`✅ ${added} gate code${added !== 1 ? "s" : ""} imported${skipMsg}`);
      setTimeout(() => router.push("/gate-codes"), 1500);
    } catch (e) {
      showToast("❌ " + (e instanceof Error ? e.message : "Import failed"));
      console.error(e);
    } finally {
      setImporting(false);
    }
  }, [rows, router, showToast]);

  const selectedCount = rows.filter((r) => r.selected).length;
  const lowConfCount  = rows.filter((r) => r.confidence < 80).length;

  return (
    <>
      <AppHeader />
      <BottomNav />

      <main style={{ padding: "16px 14px 100px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Upload */}
        {step === "upload" && (
          <div className="fade-up">
            <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 12px" }}>
              Upload screenshots containing a gate address and access code. All codes found will be listed for review.
            </p>
            <UploadZone
              icon="🔐"
              title="Upload gate code screenshots"
              subtitle="Bulk upload supported · iPhone & Android OK"
              onFiles={handleFiles}
            />
          </div>
        )}

        {/* Thumbnails */}
        {step === "thumbs" && (
          <>
            <p style={labelSt}>{thumbs.length} screenshot{thumbs.length !== 1 ? "s" : ""} selected</p>
            <ThumbnailGrid thumbs={thumbs} />
            <button onClick={runOCR} style={btnTeal}>🤖 Extract Gate Codes with AI</button>
            <button onClick={reset} style={btnOutline}>↺ Clear & start over</button>
          </>
        )}

        {/* Scanning */}
        {step === "scanning" && (
          <>
            <ThumbnailGrid thumbs={thumbs} />
            <ProgressCard message={progress.msg} sub={progress.sub} pct={progress.pct} />
          </>
        )}

        {/* Review */}
        {step === "review" && (
          <>
            {scanError && <ErrorBanner message={scanError} onRetry={reset} />}

            {/* Low confidence notice */}
            {lowConfCount > 0 && (
              <div style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                background: "var(--amber-lt)", border: "1px solid var(--amber)",
                borderRadius: "var(--radius)", padding: "12px 14px",
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>🔍</span>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--amber-dk)", margin: 0 }}>
                  {lowConfCount} code{lowConfCount !== 1 ? "s" : ""} flagged for review — confidence below 80%
                </p>
              </div>
            )}

            {/* Detected codes section */}
            {rows.length > 0 && (
              <>
                <p style={labelSt}>Detected Gate Codes</p>

                {rows.map((row, i) => {
                  const badge = confidenceBadge(row.confidence);
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        background: "var(--surface)",
                        border: `1px solid ${row.selected ? "var(--teal)" : "var(--border)"}`,
                        borderRadius: "var(--radius)", padding: "12px 14px",
                        opacity: row.selected ? 1 : 0.5,
                        transition: "border-color .15s, opacity .15s",
                      }}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleRow(i)}
                        aria-label={row.selected ? "Deselect" : "Select"}
                        style={{
                          width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                          border: `2px solid ${row.selected ? "var(--teal)" : "var(--border)"}`,
                          background: row.selected ? "var(--teal)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "pointer", color: "#fff", fontSize: 14, fontWeight: 700,
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        {row.selected ? "✓" : ""}
                      </button>

                      {/* Code + address */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 20, fontWeight: 700, color: "var(--teal)",
                          letterSpacing: "0.06em", lineHeight: 1.2,
                        }}>
                          {row.code}
                        </div>
                        <div style={{
                          fontSize: 12, color: "var(--text-2)", marginTop: 2,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {row.address}
                        </div>
                      </div>

                      {/* Confidence badge */}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 8px",
                        borderRadius: 99, flexShrink: 0,
                        background: badge.bg, color: badge.color,
                      }}>
                        {badge.label}
                      </span>
                    </div>
                  );
                })}

                {/* Import selected button */}
                <button
                  onClick={() => doImport(true)}
                  disabled={importing || selectedCount === 0}
                  style={{
                    ...btnTeal,
                    opacity: (importing || selectedCount === 0) ? 0.5 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {importing ? (
                    <>
                      <div className="spinner" style={{ borderTopColor: "#fff", borderColor: "rgba(255,255,255,.3)" }} />
                      Importing…
                    </>
                  ) : (
                    `💾 Import ${selectedCount} Selected Code${selectedCount !== 1 ? "s" : ""}`
                  )}
                </button>

                {/* Import all button (shown only when some are deselected) */}
                {selectedCount < rows.length && (
                  <button
                    onClick={() => doImport(false)}
                    disabled={importing}
                    style={{ ...btnOutline, color: "var(--teal)", borderColor: "var(--teal)" }}
                  >
                    Import All {rows.length} Codes
                  </button>
                )}
              </>
            )}

            {/* Empty state */}
            {rows.length === 0 && !scanError && (
              <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-3)", fontSize: 14 }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>😕</div>
                No gate codes detected. Try screenshots that clearly show both an address and a code.
              </div>
            )}

            {/* Warnings section */}
            {allWarnings.length > 0 && (
              <>
                <p style={{ ...labelSt, marginTop: 4 }}>Warnings</p>
                {allWarnings.map((w, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    background: "var(--danger-lt)", border: "1px solid var(--danger)",
                    borderRadius: "var(--radius)", padding: "10px 14px",
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                    <span style={{ fontSize: 13, color: "var(--danger)", fontWeight: 500 }}>
                      {w}
                    </span>
                  </div>
                ))}
              </>
            )}

            <button onClick={reset} style={{ ...btnOutline, marginTop: 4 }}>↺ Start over</button>
          </>
        )}
      </main>

      <Toast message={msg} onDone={clear} />
    </>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res((reader.result as string).split(",")[1]);
    reader.onerror = () => rej(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "var(--text-3)", margin: 0,
};
const btnTeal: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  width: "100%", padding: 16, fontSize: 16, fontWeight: 600,
  background: "var(--teal)", color: "#fff", border: "none",
  borderRadius: "var(--radius)", cursor: "pointer", WebkitTapHighlightColor: "transparent",
};
const btnOutline: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  width: "100%", padding: "10px 14px", fontSize: 14, fontWeight: 500,
  background: "none", color: "var(--text-2)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)", cursor: "pointer", WebkitTapHighlightColor: "transparent",
};
