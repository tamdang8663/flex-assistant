"use client";

import { useState } from "react";
import type { GateCode } from "@/lib/types";

interface AddGateCodeModalProps {
  /** Pre-fill address (e.g. from Route page stop) */
  defaultAddress?: string;
  onSaved: (code: GateCode) => void;
  onClose: () => void;
}

export default function AddGateCodeModal({
  defaultAddress = "",
  onSaved,
  onClose,
}: AddGateCodeModalProps) {
  const [form, setForm] = useState({
    address: defaultAddress,
    gate_code: "",
    note: "",
    status: "Working" as GateCode["status"],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    if (!form.address.trim() || !form.gate_code.trim()) {
      setError("Address and gate code are both required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/gate-codes/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.duplicate) { setError("A gate code for this address already exists."); return; }
      if (!d.ok) { setError(d.error ?? "Save failed — please try again."); return; }
      onSaved(d.data as GateCode);
    } catch {
      setError("Network error — check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,.55)",
        zIndex: 200,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 430,
          background: "var(--surface)",
          borderRadius: "20px 20px 0 0",
          padding: "12px 16px calc(env(safe-area-inset-bottom, 16px) + 16px)",
        }}
      >
        {/* Handle */}
        <div style={{ width: 38, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 16px" }} />

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "var(--text-1)" }}>
          Add Gate Code
        </h2>
        {defaultAddress && (
          <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 14px" }}>
            Adding code for this stop
          </p>
        )}

        <Field label="Address">
          <input
            autoFocus={!defaultAddress}
            type="text"
            placeholder="123 Main St, City, ST 12345"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            style={inputStyle}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Gate Code">
            <input
              autoFocus={!!defaultAddress}
              type="text"
              placeholder="#1234"
              value={form.gate_code}
              onChange={(e) => setForm((f) => ({ ...f, gate_code: e.target.value }))}
              style={inputStyle}
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as GateCode["status"] }))}
              style={inputStyle}
            >
              <option value="Working">✅ Working</option>
              <option value="Broken">❌ Broken</option>
            </select>
          </Field>
        </div>

        <Field label="Note (optional)">
          <input
            type="text"
            placeholder="e.g. Use side gate, not front"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            style={inputStyle}
          />
        </Field>

        {error && (
          <p style={{
            fontSize: 13, color: "var(--danger)", margin: "-4px 0 12px",
            background: "var(--danger-lt)", padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
          }}>
            ⚠️ {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "100%", padding: 16, fontSize: 16, fontWeight: 600,
            background: saving ? "var(--border)" : "var(--amber)",
            color: saving ? "var(--text-3)" : "#111",
            border: "none", borderRadius: "var(--radius)", cursor: saving ? "not-allowed" : "pointer",
            marginBottom: 10, WebkitTapHighlightColor: "transparent",
            transition: "background .15s",
          }}
        >
          {saving ? "Saving…" : "✓ Save Gate Code"}
        </button>

        <button
          onClick={onClose}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "100%", padding: "10px 14px", fontSize: 14, fontWeight: 500,
            background: "none", color: "var(--text-2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: "block", fontSize: 12, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.05em",
        color: "var(--text-3)", marginBottom: 5,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "13px 14px",
  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
  fontSize: 15, background: "var(--bg)", color: "var(--text-1)",
};
