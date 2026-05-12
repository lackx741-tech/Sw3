import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SW3 Platform",
  description: "Next-generation ERC20 sweeping platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
