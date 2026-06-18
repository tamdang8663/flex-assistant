"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  onDone: () => void;
}

export default function Toast({ message, onDone }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, 2600);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 16px) + 16px)",
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? 0 : 80}px)`,
        background: "#111",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: 99,
        fontSize: 14,
        fontWeight: 500,
        zIndex: 999,
        whiteSpace: "nowrap",
        opacity: visible ? 1 : 0,
        transition: "transform .25s cubic-bezier(.34,1.56,.64,1), opacity .2s",
        pointerEvents: "none",
      }}
    >
      {message}
    </div>
  );
}

// ── Hook for easy toast usage ─────────────────────────────────────────────────
import { useCallback } from "react";

export function useToast() {
  const [msg, setMsg] = useState("");
  const show = useCallback((m: string) => setMsg(m), []);
  const clear = useCallback(() => setMsg(""), []);
  return { msg, show, clear };
}
