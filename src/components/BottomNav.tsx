"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/",            label: "Home",      icon: "🏠" },
  { href: "/route",       label: "Route",     icon: "📷" },
  { href: "/gate-codes",  label: "Gates",     icon: "🔒" },
  { href: "/dashboard",   label: "Dashboard", icon: "📊" },
  { href: "/import-gates",label: "Import",    icon: "📥" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        display: "flex",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 68,
        zIndex: 40,
      }}
    >
      {TABS.map(({ href, label, icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              padding: "9px 2px",
              textDecoration: "none",
              textAlign: "center",
              color: active ? "var(--amber)" : "var(--text-3)",
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              borderBottom: `2px solid ${active ? "var(--amber)" : "transparent"}`,
              transition: "color .15s, border-color .15s",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span style={{ fontSize: 19, display: "block", marginBottom: 2 }}>
              {icon}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
