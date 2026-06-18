import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flex Assistant",
  description: "Amazon Flex driver tool — route OCR and gate codes",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,           // prevent accidental zoom while driving
  userScalable: false,
  viewportFit: "cover",      // safe-area support on notched iPhones
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Outer shell centers on wide screens; max-width keeps mobile feel */}
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "var(--bg)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 430,
              minHeight: "100dvh",
              display: "flex",
              flexDirection: "column",
              background: "var(--bg)",
              position: "relative",
            }}
          >
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
