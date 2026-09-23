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
  description: "Upload a football bet slip and get every public fact about each match: form, xG, head-to-head, referee, team news, lineups and weather.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
        <footer className="border-t border-line/70 px-4 py-6 text-center text-xs text-muted">
          Information only, not betting advice. Data comes from free public sources and can be incomplete or late. 18+ only. Need help?{" "}
          <a className="underline hover:text-fg" href="https://www.begambleaware.org" target="_blank" rel="noreferrer">
            BeGambleAware.org
          </a>{" "}
          · National Gambling Helpline 0808 8020 133.
        </footer>
      </body>
    </html>
  );
}
