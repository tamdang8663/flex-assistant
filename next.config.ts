import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Body size limit for image uploads ──────────────────────────────────────
  // This is per-request. Screenshots are typically 1–4 MB.
  // Set to 20 MB to handle uncompressed PNGs.
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },

  // ── Security headers ────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Prevent framing (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Referrer privacy
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Permissions policy (disable camera/mic — this is a screenshot app)
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // ── Compiler options ────────────────────────────────────────────────────────
  compiler: {
    // Remove console.log in production (keep console.error)
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },

  // ── Build output ────────────────────────────────────────────────────────────
  // "standalone" bundles everything needed for deployment
  // Vercel handles this automatically; useful for Docker/self-hosting
  // output: "standalone",

  // ── Strict mode ────────────────────────────────────────────────────────────
  reactStrictMode: true,
};

export default nextConfig;
