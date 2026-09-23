import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SlipCheck",
  description: "Upload a bet slip and see which sportsbook pays the most for the same bet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
        <footer className="border-t border-line/70 px-4 py-6 text-center text-xs text-muted">
          For information only. Odds change quickly, so always confirm on the sportsbook before betting. Must be 21+.
          Gambling problem? Call{" "}
          <a className="underline hover:text-fg" href="tel:18004262537">
            1-800-GAMBLER
          </a>
          .
        </footer>
      </body>
    </html>
  );
}
