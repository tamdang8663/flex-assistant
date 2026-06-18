/**
 * Gate code storage — localStorage for now.
 * When you add Supabase in a later phase, swap this module's
 * internals without touching any component code.
 */
import type { GateCode } from "./types";

const KEY = "fa_gate_codes";

export function loadGateCodes(): GateCode[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveGateCodes(codes: GateCode[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(codes));
}

export function addGateCode(
  codes: GateCode[],
  entry: Omit<GateCode, "id" | "created_at">
): GateCode[] {
  const next: GateCode = {
    ...entry,
    id: Date.now(),
    created_at: new Date().toISOString(),
  };
  const updated = [next, ...codes];
  saveGateCodes(updated);
  return updated;
}

export function bulkAddGateCodes(
  existing: GateCode[],
  entries: Omit<GateCode, "id" | "created_at">[]
): { codes: GateCode[]; added: number } {
  let added = 0;
  let codes = [...existing];
  for (const entry of entries) {
    const isDup = codes.some(
      (g) => g.address === entry.address && g.gate_code === entry.gate_code
    );
    if (!isDup) {
      codes = addGateCode(codes, entry);
      added++;
    }
  }
  saveGateCodes(codes);
  return { codes, added };
}

export function addressHasGateCode(
  codes: GateCode[],
  address: string
): GateCode | undefined {
  const normalised = address.toLowerCase();
  return codes.find((g) => {
    const gNorm = g.address.toLowerCase();
    // Check if the street portion of either address is contained in the other
    const gStreet = gNorm.split(",")[0].trim();
    const aStreet = normalised.split(",")[0].trim();
    return (
      gNorm.includes(aStreet) ||
      normalised.includes(gStreet) ||
      gStreet === aStreet
    );
  });
}
