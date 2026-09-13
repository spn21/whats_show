
import "./globals.css";
import { ClientProviders } from "@/components/layout";
import type { Metadata } from "next";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen bg-background text-foreground flex flex-col">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}

export const metadata: Metadata = {
  title: "zkAssetRaffle",
  description: "Fair, verifiable raffles for real‑world assets using zero‑knowledge proofs.",
  applicationName: "zkAssetRaffle",
  icons: {
    icon: "/favicon.ico",
  },
  keywords: ["zk", "raffle", "RWA", "blockchain", "zero-knowledge"],
};
