import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-foreground/40">
        <Link href="/" className="font-mono">
          Make<span className="text-accent/60">matik</span>
        </Link>
        <span>&copy; 2026 Makematik</span>
      </div>
    </footer>
  );
}
