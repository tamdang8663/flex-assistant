/**
 * POST /api/ocr
 *
 * OCR provider: OCR.space API (https://ocr.space/ocrapi)
 * API key: OCR_SPACE_API_KEY (server-side only, never sent to browser)
 *
 * Body: OcrRequest  (imageBase64, mimeType, mode)
 * Returns: OcrResponse
 */

import { NextRequest, NextResponse } from "next/server";
import type { OcrRequest, OcrResponse } from "@/lib/types";

const OCR_SPACE_URL = "https://api.ocr.space/parse/image";

// ── Blacklist: exact lowercase strings that are never valid gate codes ─────────
const BLACKLISTED = new Set([
  "notes", "note", "optional", "recipient", "delivery", "deliveries",
  "address", "access", "codes", "code", "gate", "door", "entry", "pin",
  "please", "enter", "unit", "apt", "suite", "building", "floor",
  "call", "buzz", "ring", "press", "use", "front", "back", "side",
  "left", "right", "main", "parking", "lot", "garage", "lobby",
  "learn", "more", "problem", "report", "understand", "required",
  "dog", "dogs", "location", "package", "customer", "amazon", "flex",
]);

// ── Warning line patterns ─────────────────────────────────────────────────────
// Lines matching these are captured as human-readable warnings, not codes.
const WARNING_PATTERNS: RegExp[] = [
  /be aware of/i,
  /dog (at|on|in)/i,
  /caution/i,
  /warning/i,
  /alert/i,
  /learn more/i,
  /report a problem/i,
  /no recipient/i,
  /recipient required/i,
  /delivery instructions?/i,
  /delivery note/i,
  /i have read/i,
];

// ── Label pattern: lines that introduce a list of access codes ────────────────
const LABEL_RE =
  /(?:access\s+codes?|gate\s+codes?|door\s+codes?|entry\s+codes?|access\s+pin|code)\s*:?\s*/i;

// ── scoreCode: returns -1 to reject, ≥0 to accept (higher = better) ──────────
function scoreCode(s: string): number {
  const t = s.trim();
  if (!t) return -1;
  if (BLACKLISTED.has(t.toLowerCase())) return -1;
  if (!/\d/.test(t)) return -1;
  // Must start with digit, # or * — rejects garbage like "an +5701#", "note#5678"
  if (!/^[\d#*]/.test(t)) return -1;
  // Strip symbols to check raw length
  if (t.replace(/[^A-Z0-9]/gi, "").length > 10) return -1;

  let score = 0;
  if (/^[#*]/.test(t) || /[#*]$/.test(t)) score += 30;  // has # or * on either end
  if (/^[*#].*[*#]$/.test(t)) score += 10;               // both ends
  if (/^\d{4,8}$/.test(t)) score += 20;                  // pure digits 4–8
  if (/^\d{4}$/.test(t)) score += 5;                     // 4-digit bonus
  score -= Math.max(0, t.length - 6);                    // penalise length
  return score;
}

// ── digitsOnly: extract numeric characters only ───────────────────────────────
function digitsOnly(s: string): string {
  return s.replace(/[^0-9]/g, "");
}

// ── extractTokensFromSegment: split comma-list and strip sub-labels ───────────
// Input:  "*5701#, Access:*5701#, Access:#5701, 1814#, 1814"
// Output: ["*5701#", "*5701#", "#5701", "1814#", "1814"]
function extractTokensFromSegment(seg: string): string[] {
  return seg
    .split(/[,;\[\]]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.replace(/^(?:access|gate|door|entry|pin|code)\s*:\s*/i, "").trim())
    .filter((p) => p && /\d/.test(p));
}

// ── deduplicateCodes ──────────────────────────────────────────────────────────
// Rules:
//   1. Never return the exact same string twice (case-insensitive).
//   2. Drop a pure-digit entry when a BOTH-sided symbolic variant (*1234#)
//      with the same digits is already in the list.
//      Rationale: *5701# already encodes "5701"; returning "5701" too is noise.
//      But keep "1814" alongside "1814#" because "1814#" is only one-sided —
//      the driver might need to try the bare version too.
function deduplicateCodes(codes: string[]): string[] {
  // Step 1: exact-value dedup (first occurrence wins)
  const seenExact = new Set<string>();
  const deduped: string[] = [];
  for (const c of codes) {
    const key = c.toLowerCase();
    if (!seenExact.has(key)) {
      seenExact.add(key);
      deduped.push(c);
    }
  }

  // Step 2: drop bare-digit entry when a both-sided variant covers same digits
  return deduped.filter((code) => {
    if (!/^[0-9]+$/.test(code)) return true; // not a pure-digit entry — keep always
    const digits = digitsOnly(code);
    const hasBothSidesVariant = deduped.some(
      (other) =>
        other !== code &&
        /^[#*]/.test(other) &&
        /[#*]$/.test(other) &&
        digitsOnly(other) === digits
    );
    return !hasBothSidesVariant;
  });
}

// ── parseGateData ─────────────────────────────────────────────────────────────
//
// Returns:
//   address   — cleaned street address
//   codes     — all valid gate codes, deduped, ordered (labeled first)
//   confidence— 0–100
//   warnings  — meaningful human-readable warnings (dog, caution, etc.)
//
function parseGateData(text: string): {
  address: string;
  codes: string[];
  confidence: number;
  warnings: string[];
} {
  const empty = { address: "", codes: [], confidence: 0, warnings: [] };
  if (!text || !text.trim()) return empty;

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const rawCodes: string[] = []; // ordered, pre-dedup

  function addCode(raw: string) {
    const t = raw.trim();
    if (scoreCode(t) >= 0) rawCodes.push(t);
  }

  // ── Pass 1: labeled lines — highest priority, preserve comma order ──────────
  for (const line of lines) {
    if (LABEL_RE.test(line)) {
      const seg = line.replace(LABEL_RE, "").trim();
      for (const tok of extractTokensFromSegment(seg)) addCode(tok);
    }
  }

  // ── Pass 2: bare #/* tokens on non-warning lines ────────────────────────────
  for (const line of lines) {
    if (WARNING_PATTERNS.some((p) => p.test(line))) continue;
    for (const m of line.matchAll(/[#*][A-Z0-9]{3,8}[#*]?|[#*]?[A-Z0-9]{3,8}[#*]/gi)) {
      addCode(m[0]);
    }
  }

  // ── Pass 3: bare 4–8 digit numbers on non-warning, non-label lines ──────────
  for (const line of lines) {
    if (WARNING_PATTERNS.some((p) => p.test(line))) continue;
    if (LABEL_RE.test(line)) continue; // already processed in pass 1
    for (const m of line.matchAll(/\b(\d{4,8})\b/g)) {
      addCode(m[1]);
    }
  }

  const codes = deduplicateCodes(rawCodes);

  // ── Address extraction ────────────────────────────────────────────────────
  // Unchanged from previous working version.
  let address = "";
  for (const line of lines) {
    const cleaned = line
      .replace(/^[^A-Za-z0-9]+/, "")       // strip leading Unicode / symbols (① etc.)
      .replace(/^[A-Za-z]{1}\s+(?=\d)/, "") // strip single-letter OCR noise
      .trim();
    if (/^\d+\s+[A-Za-z]/.test(cleaned) && cleaned.length > 8) {
      address = cleaned;
      break;
    }
  }

  // ── Warnings — only lines that are actionable for a driver ─────────────────
  const warnings = lines.filter((line) =>
    WARNING_PATTERNS.some((p) => p.test(line))
  );

  const confidence =
    codes.length === 0 ? 0 : rawCodes.some((_, i) => i === 0) ? 90 : 75;

  console.log(
    `Gate mode: address="${address}", codes=${JSON.stringify(codes)}, confidence=${confidence}, warnings=${warnings.length}`
  );

  return { address, codes, confidence, warnings };
}

// ── parseRouteAddresses — unchanged ──────────────────────────────────────────
function parseRouteAddresses(text: string): { addresses: string[]; confidence: number } {
  if (!text || text.trim() === "") return { addresses: [], confidence: 0 };

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /\d/.test(l))
    .filter((l) => l.length > 8)
    .filter(
      (l) =>
        !/^(package|packages|stop|stops|delivery|delivering|amazon|flex|route|driver|total|time|window|\d+\s*(pkg|pkgs))/i.test(
          l
        )
    )
    .map((l) => l.replace(/^\d+[.)]\s+/, ""))
    .map((l) => l.replace(/^[-•*]\s+/, ""))
    .map((l) => l.replace(/^[^A-Za-z0-9]+/, ""))
    .map((l) => l.replace(/^[A-Za-z]{1}\s+(?=\d)/, ""))
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => /^\d/.test(l));

  const unique = [...new Set(lines)];
  const addressLike = unique.filter((l) => /,/.test(l) || /\b[A-Z]{2}\b/.test(l));
  const confidence =
    unique.length === 0
      ? 0
      : Math.round(40 + (addressLike.length / unique.length) * 55);

  return { addresses: unique, confidence };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<OcrResponse>> {
  try {
    const body = (await req.json()) as OcrRequest;
    const { imageBase64, mimeType, mode } = body;

    if (!imageBase64 || !mimeType || !mode) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: imageBase64, mimeType, mode" },
        { status: 400 }
      );
    }

    if (!["route", "gate"].includes(mode)) {
      return NextResponse.json(
        { ok: false, error: `Invalid mode "${mode}". Must be "route" or "gate"` },
        { status: 400 }
      );
    }

    const validMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validMimeTypes.includes(mimeType)) {
      return NextResponse.json(
        { ok: false, error: `Unsupported image type: ${mimeType}. Use JPEG or PNG.` },
        { status: 400 }
      );
    }

    const apiKey = process.env.OCR_SPACE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Server configuration error: OCR_SPACE_API_KEY not set." },
        { status: 500 }
      );
    }

    console.log("OCR.space request started");

    const formData = new FormData();
    formData.append("base64Image", `data:${mimeType};base64,${imageBase64}`);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "false");
    formData.append("detectOrientation", "true");
    formData.append("scale", "true");
    formData.append("isTable", "false");
    formData.append("OCREngine", "2");

    const ocrRes = await fetch(OCR_SPACE_URL, {
      method: "POST",
      headers: { apikey: apiKey },
      body: formData,
    });

    if (!ocrRes.ok) {
      const errText = await ocrRes.text().catch(() => "");
      console.error("OCR.space HTTP error:", ocrRes.status, errText);
      return NextResponse.json(
        { ok: false, error: `OCR API failed (HTTP ${ocrRes.status})` },
        { status: 502 }
      );
    }

    const ocrData = (await ocrRes.json()) as {
      IsErroredOnProcessing?: boolean;
      ErrorMessage?: string | string[];
      ParsedResults?: Array<{ ParsedText: string; ErrorMessage?: string }>;
    };

    if (ocrData.IsErroredOnProcessing) {
      const msg = Array.isArray(ocrData.ErrorMessage)
        ? ocrData.ErrorMessage.join("; ")
        : (ocrData.ErrorMessage ?? "OCR processing failed");
      console.error("OCR.space processing error:", msg);
      return NextResponse.json(
        { ok: false, error: `OCR API failed: ${msg}` },
        { status: 422 }
      );
    }

    if (!ocrData.ParsedResults || ocrData.ParsedResults.length === 0) {
      console.error("OCR.space returned no ParsedResults");
      return NextResponse.json(
        { ok: false, error: "OCR returned empty text" },
        { status: 422 }
      );
    }

    const parsedText = (ocrData.ParsedResults[0].ParsedText ?? "").trim();

    console.log("OCR.space success");
    console.log("OCR text length =", parsedText.length);

    if (!parsedText) {
      return NextResponse.json(
        { ok: false, error: "OCR returned empty text" },
        { status: 422 }
      );
    }

    // ── Route mode ───────────────────────────────────────────────────────────
    if (mode === "route") {
      const { addresses, confidence } = parseRouteAddresses(parsedText);
      console.log(`Route mode: extracted ${addresses.length} addresses, confidence=${confidence}`);
      return NextResponse.json({
        ok: true,
        mode: "route",
        data: { addresses, confidence },
      });
    }

    // ── Gate mode ────────────────────────────────────────────────────────────
    const gateResult = parseGateData(parsedText);

    if (!gateResult.address || gateResult.codes.length === 0) {
      return NextResponse.json({
        ok: true,
        mode: "gate",
        data: { address: "", codes: [], confidence: 0, warnings: gateResult.warnings },
      });
    }

    return NextResponse.json({
      ok: true,
      mode: "gate",
      data: gateResult,
    });

  } catch (err) {
    console.error("[/api/ocr] unexpected error:", err);

    let userMessage = "OCR parsing failed. Please try again.";
    if (err instanceof Error) {
      if (err.message.includes("fetch") || err.message.includes("ECONNREFUSED")) {
        userMessage = "OCR API failed: could not reach OCR service. Check your network.";
      } else if (err.message.includes("timeout") || err.message.includes("ETIMEDOUT")) {
        userMessage = "OCR API failed: request timed out. Try a smaller image.";
      }
    }

    return NextResponse.json({ ok: false, error: userMessage }, { status: 500 });
  }
}
