import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Makematik — On fabrique vos outils métier",
  description:
    "Création d'outils numériques sur mesure pour TPE/PME : automatisation, apps métier, centralisation de données.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="antialiased">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
