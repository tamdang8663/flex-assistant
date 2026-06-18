export interface GateCode { id: number; address: string; gate_code: string; note: string; status: "Working" | "Broken"; created_at: string; }
export interface OcrRequest { imageBase64: string; mimeType: string; mode: "route" | "gate"; }
export interface OcrRouteResult { addresses: string[]; confidence: number; }
export interface OcrGateResult { address: string; codes: string[]; confidence: number; warnings: string[]; }
export type OcrResponse = | { ok: true; mode: "route"; data: OcrRouteResult } | { ok: true; mode: "gate"; data: OcrGateResult } | { ok: false; error: string };
export interface RouteAnalysisRequest { addresses: string[]; startTime?: string; }
export interface RouteStop { address: string; hasGateCode: boolean; }
export interface RouteAnalysisResult { totalStops: number; totalMiles: number; totalKm: number; drivingTimeMinutes: number; drivingTimeFormatted: string; estimatedFinish: string; estimatedFinishFormatted: string; stops: RouteStop[]; gateCodesFound: number; source: "google" | "ors" | "estimate"; }
export interface RouteAnalysisResponse { ok: boolean; data?: RouteAnalysisResult; error?: string; }
export interface GateCodeSearchRequest { query: string; limit?: number; }
export interface GateCodeSearchResponse { ok: boolean; data?: GateCode[]; error?: string; }
export interface GateCodeAddRequest { address: string; gate_code: string; note?: string; status?: "Working" | "Broken"; }
export interface GateCodeAddResponse { ok: boolean; data?: GateCode; error?: string; duplicate?: boolean; }
export interface GateCodeBulkAddRequest { entries: GateCodeAddRequest[]; }
export interface GateCodeBulkAddResponse { ok: boolean; added: number; skipped: number; error?: string; }
export interface GateCodeStatusRequest { id: number; status: "Working" | "Broken"; }
export interface GateCodeStatusResponse { ok: boolean; data?: GateCode; error?: string; }
export interface RouteStopWithGate { address: string; gateCode: GateCode | null; }
export interface GateCodeStats { total: number; working: number; broken: number; recentlyAdded: number; }
export interface GateCodeStatsResponse { ok: boolean; data?: GateCodeStats; error?: string; }