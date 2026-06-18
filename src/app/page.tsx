"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import type { GateCodeStats } from "@/lib/types";

function getSessionStops(): number {
  try { return JSON.parse(sessionStorage.getItem("fa_stops") ?? "[]").length; }
  catch { return 0; }
}

const ACTIONS = [
  {
    href: "/route",
    icon: "📷",
    bg: "#FFF3DC",
    title: "Upload Route Screenshots",
    sub: "AI extracts addresses & checks gate codes",
  },
  {
    href: "/import-gates",
    icon: "📥",
    bg: "var(--teal-lt)",
    title: "Import Gate Code Screenshots",
    sub: "Build your database hands-free with AI",
  },
  {
    href: "/gate-codes",
    icon: "🔍",
    bg: "var(--amber-lt)",
    title: "Search Gate Codes",
    sub: "Find by address, street number, or code",
  },
  {
    href: "/dashboard",
    icon: "📊",
    bg: "#EEF0FF",
    title: "View Dashboard",
    sub: "Total codes, working vs broken, recent adds",
  },
] as const;

export default function HomePage() {
  const [stops, setStops]   = useState(0);
  const [stats, setStats]   = useState<GateCodeStats | null>(null);

  useEffect(() => {
    setStops(getSessionStops());
    fetch("/api/gate-codes/stats")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setStats(d.data); })
      .catch(() => {});

    const onFocus = () => setStops(getSessionStops());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <>
      <AppHeader />
      <BottomNav />
      <main style={{ padding: "16px 14px 100px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={statCard}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-1)" }}>{stops}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>Stops Loaded</div>
          </div>
          <div style={statCard}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-1)" }}>
              {stats ? stats.total : "…"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>Gate Codes</div>
          </div>
        </div>

        {/* Mini health row */}
        {stats && stats.total > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, background: "var(--teal-lt)", borderRadius: "var(--radius-sm)", padding: "8px 12px", textAlign: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--teal-dk)" }}>
                ✅ {stats.working} Working
              </span>
            </div>
            <div style={{ flex: 1, background: "var(--danger-lt)", borderRadius: "var(--radius-sm)", padding: "8px 12px", textAlign: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)" }}>
                ❌ {stats.broken} Broken
              </span>
            </div>
          </div>
        )}

        <p style={labelSt}>Quick actions</p>

        {ACTIONS.map(({ href, icon, bg, title, sub }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "16px 16px", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: "var(--radius)",
              textDecoration: "none", WebkitTapHighlightColor: "transparent",
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, flexShrink: 0,
            }} aria-hidden="true">
              {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)" }}>{title}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2, lineHeight: 1.4 }}>{sub}</div>
            </div>
            <span style={{ marginLeft: "auto", fontSize: 18, color: "var(--text-3)", flexShrink: 0 }}>›</span>
          </Link>
        ))}
      </main>
    </>
  );
}

const statCard: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", padding: 14, textAlign: "center",
};
const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "var(--text-3)", margin: "4px 0 0",
};
