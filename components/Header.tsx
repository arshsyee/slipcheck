"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Receipt, Settings } from "lucide-react";
import clsx from "clsx";

export function Header() {
  const path = usePathname();
  const nav = [
    { href: "/", label: "My slip", icon: Receipt },
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-bg shadow-[0_0_24px_rgba(46,224,127,0.45)]">
            <Receipt size={18} strokeWidth={2.5} />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Slip<span className="text-accent">Check</span>
          </span>
        </Link>
        <nav className="flex gap-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                path === href ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
              )}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
