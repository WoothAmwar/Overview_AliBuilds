import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JusticeLink — Cook County legal-aid sidekick",
  description:
    "Agentic legal-aid sidekick for Cook County child-support and maintenance enforcement. Built at ALI Builds 2026.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
