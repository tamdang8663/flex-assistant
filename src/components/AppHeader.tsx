"use client";

export default function AppHeader() {
  return (
    <header
      style={{
        background: "#111",
        padding: "max(env(safe-area-inset-top, 12px), 12px) 16px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 40,
          height: 40,
          background: "var(--amber)",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        🚐
      </div>

      <div>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.3px",
            margin: 0,
          }}
        >
          Flex Assistant
        </h1>
        <p style={{ fontSize: 12, color: "#999", margin: "1px 0 0" }}>
          Amazon Flex Driver Tool
        </p>
      </div>
    </header>
  );
}
