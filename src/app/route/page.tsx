"use client";

import { useCallback, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import UploadZone from "@/components/UploadZone";
import ThumbnailGrid, { ThumbFile } from "@/components/ThumbnailGrid";
import ProgressCard from "@/components/ProgressCard";
import RouteAnalysisDashboard from "@/components/RouteAnalysisDashboard";
import AddGateCodeModal from "@/components/AddGateCodeModal";
import OcrWarningBanner, { detectLowConfidenceAddresses } from "@/components/OcrWarningBanner";
import ErrorBanner from "@/components/ErrorBanner";
import Toast, { useToast } from "@/components/Toast";
import type { GateCode, OcrResponse, RouteAnalysisResult, RouteStopWithGate } from "@/lib/types";

type Step = "upload" | "thumbs" | "scanning" | "results";

function mapsUrl(address: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

export default function RoutePage() {
  const [step, setStep]           = useState<Step>("upload");
  const [thumbs, setThumbs]       = useState<ThumbFile[]>([]);
  const [progress, setProgress]   = useState({ pct: 0, msg: "Preparing…", sub: "" });
  const [addresses, setAddresses] = useState<string[]>([]);
  const [analysis, setAnalysis]   = useState<RouteAnalysisResult | null>(null);
  const [stops, setStops]         = useState<RouteStopWithGate[]>([]);
  const [warnings, setWarnings]   = useState<string[]>([]);
  const [scanError, setScanError] = useState("");
  const [addFor, setAddFor]       = useState<string | null>(null);

  const { msg: toastMsg, show: showToast, clear: clearToast } = useToast();

  const handleFiles = useCallback((files: File[]) => {
    setScanError("");
    setThumbs(files.map((f) => ({
      file: f, previewUrl: URL.createObjectURL(f), status: "ready" as const,
    })));
    setStep("thumbs");
  }, []);

  const reset = () => {
    thumbs.forEach((t) => URL.revokeObjectURL(t.previewUrl));
    setThumbs([]); setAddresses([]); setAnalysis(null);
    setStops([]); setWarnings([]); setScanError("");
    setStep("upload");
  };

  // ── OCR loop ───────────────────────────────────────────────────────────────
  async function runOCR() {
    setScanError("");
    setStep("scanning");
    setProgress({ pct: 5, msg: "Preparing screenshots…", sub: "" });
    const all: string[] = [];
    let failCount = 0;

    for (let i = 0; i < thumbs.length; i++) {
      const pct = Math.round(5 + (i / thumbs.length) * 72);
      setProgress({
        pct,
        msg: `Scanning ${i + 1} of ${thumbs.length} screenshots…`,
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
            mode: "route",
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error((errData as { error?: string }).error ?? `HTTP ${res.status}`);
        }

        const data: OcrResponse = await res.json();

        if (data.ok && data.mode === "route") {
          all.push(...data.data.addresses);
          setThumbs((p) => p.map((t, idx) =>
            idx === i ? { ...t, status: "done" as const } : t
          ));
        } else if (!data.ok) {
          throw new Error(data.error);
        }
      } catch (err) {
        failCount++;
        console.error("OCR error image", i, err);
        setThumbs((p) => p.map((t, idx) =>
          idx === i ? { ...t, status: "error" as const } : t
        ));
      }
    }

    const deduped = [...new Set(all)];
    setAddresses(deduped);
    sessionStorage.setItem("fa_stops", JSON.stringify(deduped));

    // OCR confidence warnings
    setWarnings(detectLowConfidenceAddresses(deduped));

    if (deduped.length === 0 && failCount === thumbs.length) {
      setScanError("All screenshots failed to scan. Check your network connection and try again.");
      setStep("results");
      return;
    }

    setProgress({ pct: 82, msg: `✓ Found ${deduped.length} addresses — checking gate codes…`, sub: "" });
    await runAnalysis(deduped);
  }

  // ── Route analysis + Supabase gate lookup ─────────────────────────────────
  async function runAnalysis(addrs: string[]) {
    if (addrs.length === 0) { setStep("results"); return; }
    setProgress((p) => ({ ...p, pct: 92, msg: "Calculating route & checking gate codes…" }));

    try {
      const res = await fetch("/api/route-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: addrs }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok) {
        setAnalysis(data.data as RouteAnalysisResult);
        setStops((data.stops as RouteStopWithGate[]) ?? []);
      }
    } catch (err) {
      console.error("Route analysis failed", err);
      // Non-fatal — show addresses without analysis
    } finally {
      setProgress({ pct: 100, msg: "Done!", sub: "" });
      setStep("results");
    }
  }

  function handleGateAdded(newCode: GateCode) {
    setStops((prev) =>
      prev.map((s) => s.address === addFor ? { ...s, gateCode: newCode } : s)
    );
    setAnalysis((prev) =>
      prev ? { ...prev, gateCodesFound: prev.gateCodesFound + 1 } : prev
    );
    setAddFor(null);
    showToast("✅ Gate code saved!");
  }

  const copyAddresses = () => {
    navigator.clipboard?.writeText(addresses.join("\n"))
      .then(() => showToast("📋 Addresses copied!"))
      .catch(() => showToast("Copy failed — try selecting manually"));
  };

  const displayStops: RouteStopWithGate[] =
    stops.length > 0 ? stops : addresses.map((a) => ({ address: a, gateCode: null }));

  const gateFound  = displayStops.filter((s) => s.gateCode !== null).length;
  const gateNeeded = displayStops.filter((s) => s.gateCode === null).length;

  return (
    <>
      <AppHeader />
      <BottomNav />

      <main style={{ padding: "16px 14px 100px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Upload */}
        {step === "upload" && (
          <div className="fade-up">
            <UploadZone
              icon="🖼️"
              title="Upload itinerary screenshots"
              subtitle={"Tap to select · Drag & drop OK\niPhone & Android supported"}
              onFiles={handleFiles}
            />
          </div>
        )}

        {/* Thumbnails */}
        {step === "thumbs" && (
          <>
            <p style={labelSt} className="fade-up">
              {thumbs.length} screenshot{thumbs.length !== 1 ? "s" : ""} selected
            </p>
            <ThumbnailGrid thumbs={thumbs} />
            <button onClick={runOCR} style={btnAmber}>
              🤖 Extract Addresses with AI
            </button>
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

        {/* Results */}
        {step === "results" && (
          <>
            {scanError && (
              <ErrorBanner message={scanError} onRetry={reset} />
            )}

            {analysis && <RouteAnalysisDashboard result={analysis} />}

            {/* Gate summary strip */}
            {displayStops.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{
                  background: "var(--teal-lt)", borderRadius: "var(--radius-sm)",
                  padding: "10px 12px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--teal-dk)" }}>
                    {gateFound}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--teal-dk)", fontWeight: 600, marginTop: 2 }}>
                    🔒 Gate Codes Found
                  </div>
                </div>
                <div style={{
                  background: gateNeeded > 0 ? "var(--amber-lt)" : "var(--bg)",
                  borderRadius: "var(--radius-sm)", padding: "10px 12px", textAlign: "center",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: gateNeeded > 0 ? "var(--amber-dk)" : "var(--text-3)" }}>
                    {gateNeeded}
                  </div>
                  <div style={{ fontSize: 11, color: gateNeeded > 0 ? "var(--amber-dk)" : "var(--text-3)", fontWeight: 600, marginTop: 2 }}>
                    ⚠️ No Code Yet
                  </div>
                </div>
              </div>
            )}

            {/* OCR confidence warnings */}
            {warnings.length > 0 && <OcrWarningBanner warnings={warnings} />}

            {/* List header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={labelSt}>{addresses.length} stop{addresses.length !== 1 ? "s" : ""}</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={copyAddresses} style={btnOutline}>📋 Copy all</button>
                <button onClick={reset} style={btnOutline}>↺ Redo</button>
              </div>
            </div>

            {/* Stop list */}
            {displayStops.length === 0 && !scanError ? (
              <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-3)", fontSize: 14 }}>
                <div style={{ fontSize: 48, marginBottom: 10 }}>😕</div>
                No addresses found. Try a clearer, well-lit screenshot.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {displayStops.map(({ address, gateCode }, i) => (
                  <StopCard
                    key={i}
                    index={i}
                    address={address}
                    gateCode={gateCode}
                    onAddCode={() => setAddFor(address)}
                    onCopy={() => {
                      navigator.clipboard?.writeText(address)
                        .then(() => showToast("📋 Address copied!"))
                        .catch(() => {});
                    }}
                  />
                ))}
              </div>
            )}

            {displayStops.length > 0 && (
              <button onClick={reset} style={{ ...btnOutline, marginTop: 4 }}>
                ↺ Scan new screenshots
              </button>
            )}
          </>
        )}
      </main>

      {addFor !== null && (
        <AddGateCodeModal
          defaultAddress={addFor}
          onSaved={handleGateAdded}
          onClose={() => setAddFor(null)}
        />
      )}

      <Toast message={toastMsg} onDone={clearToast} />
    </>
  );
}

// ── StopCard ──────────────────────────────────────────────────────────────────

interface StopCardProps {
  index: number;
  address: string;
  gateCode: GateCode | null;
  onAddCode: () => void;
  onCopy: () => void;
}

function StopCard({ index, address, gateCode, onAddCode, onCopy }: StopCardProps) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-sm)",
      overflow: "hidden",
    }}>
      {/* Main row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px" }}>
        {/* Stop number */}
        <div style={{
          width: 26, height: 26, borderRadius: "50%", flexShrink: 0, marginTop: 1,
          background: "var(--amber-lt)", color: "var(--amber-dk)",
          fontSize: 12, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {index + 1}
        </div>

        {/* Address + note */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, lineHeight: 1.4, color: "var(--text-1)" }}>
            {address}
          </div>
          {gateCode?.note && (
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>
              {gateCode.note}
            </div>
          )}
        </div>

        {/* Gate code badge */}
        {gateCode ? (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
              textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4,
              background: gateCode.status === "Working" ? "var(--teal-lt)" : "var(--danger-lt)",
              color: gateCode.status === "Working" ? "var(--teal-dk)" : "var(--danger)",
            }}>
              {gateCode.status === "Working" ? "✅ Working" : "❌ Broken"}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--teal)", letterSpacing: "0.06em" }}>
              🔒 {gateCode.gate_code}
            </div>
          </div>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99,
            textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0,
            background: "var(--bg)", color: "var(--text-3)", border: "1px solid var(--border)",
          }}>
            No Code
          </span>
        )}
      </div>

      {/* Action strip */}
      <div style={{
        display: "flex",
        borderTop: "1px solid var(--border)",
      }}>
        {/* Copy address */}
        <button
          onClick={onCopy}
          style={{
            flex: 1, padding: "8px 0", background: "none", border: "none",
            borderRight: "1px solid var(--border)",
            fontSize: 12, fontWeight: 600, color: "var(--text-2)",
            cursor: "pointer", WebkitTapHighlightColor: "transparent",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}
        >
          📋 Copy
        </button>

        {/* Open in Maps */}
        <a
          href={mapsUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1, padding: "8px 0",
            borderRight: gateCode ? "none" : "1px solid var(--border)",
            fontSize: 12, fontWeight: 600, color: "var(--text-2)",
            textDecoration: "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          🗺️ Maps
        </a>

        {/* Add gate code — only if none exists */}
        {!gateCode && (
          <button
            onClick={onAddCode}
            style={{
              flex: 1.4, padding: "8px 0", background: "var(--amber-lt)", border: "none",
              fontSize: 12, fontWeight: 700, color: "var(--amber-dk)",
              cursor: "pointer", WebkitTapHighlightColor: "transparent",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}
          >
            ＋ Add Code
          </button>
        )}

        {/* Copy gate code — only if one exists */}
        {gateCode && (
          <button
            onClick={() => {
              navigator.clipboard?.writeText(gateCode.gate_code).catch(() => {});
            }}
            style={{
              flex: 1, padding: "8px 0", background: "var(--teal-lt)", border: "none",
              fontSize: 12, fontWeight: 700, color: "var(--teal-dk)",
              cursor: "pointer", WebkitTapHighlightColor: "transparent",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}
          >
            🔒 Copy Code
          </button>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
const btnAmber: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  width: "100%", padding: 16, fontSize: 16, fontWeight: 600,
  background: "var(--amber)", color: "#111", border: "none",
  borderRadius: "var(--radius)", cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};
const btnOutline: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  padding: "10px 14px", fontSize: 14, fontWeight: 500,
  background: "none", color: "var(--text-2)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)", cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};
