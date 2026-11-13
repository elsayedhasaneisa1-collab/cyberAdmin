import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cairo, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ZeroTraceProvider } from "@/context/zero-trace-context";
import { AppShell } from "@/components/shell/app-shell";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cairo",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "ZERO TRACE — ELITE CYBER INTELLIGENCE SYSTEM",
  description:
    "Defensive Cyber Intelligence Command Platform & Dynamic Telegram Bot Management System.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased selection:bg-[#00ff88]/30 selection:text-white">
        <ZeroTraceProvider>
          <AppShell>{children}</AppShell>
        </ZeroTraceProvider>
      </body>
    </html>
  );
}
