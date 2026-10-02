import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { ShieldCheck } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Release Readiness",
  description: "Turn release notes into a reviewed, evidence-backed readiness brief.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans text-foreground antialiased`}>
        <TooltipProvider delayDuration={150}>
          <header className="sticky top-0 z-30 border-b border-border/70 bg-white/70 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                Release Readiness
              </Link>
              <span className="hidden rounded-full border px-2 py-0.5 text-xs text-muted-foreground sm:inline">
                AI drafts · humans decide
              </span>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <Toaster richColors position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
