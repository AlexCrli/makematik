"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/realisations", label: "Réalisations" },
  { href: "/a-propos", label: "À propos" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-6 h-16">
        <Link href="/" className="font-bold text-lg tracking-tight">
          Make<span className="text-accent">matik</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors duration-200 ${
                pathname === link.href
                  ? "text-accent"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/app/login"
            className="text-sm px-4 py-1.5 rounded-lg border border-accent text-accent hover:bg-accent hover:text-white transition-all duration-200"
          >
            Se connecter
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 text-foreground/60 hover:text-foreground"
          aria-label="Menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border bg-background px-6 py-4 space-y-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block text-sm transition-colors duration-200 ${
                pathname === link.href
                  ? "text-accent"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/app/login"
            onClick={() => setOpen(false)}
            className="inline-block text-sm px-4 py-1.5 mt-2 rounded-lg border border-accent text-accent hover:bg-accent hover:text-white transition-all duration-200"
          >
            Se connecter
          </Link>
        </div>
      )}
    </nav>
  );
}
