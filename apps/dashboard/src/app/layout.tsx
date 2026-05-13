import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AppShell } from "../components/shell/app-shell";

export const metadata: Metadata = {
  title: {
    default: "SW3 — Web3 Operating System",
    template: "%s · SW3",
  },
  description:
    "SW3 is the operator console for ERC-20 sweeping, EIP-7702 delegation, and multi-chain orchestration. Built for teams who ship at the edge.",
  applicationName: "SW3 Console",
  metadataBase: new URL("https://sw3.io"),
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#050816",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="min-h-screen bg-void-900">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
