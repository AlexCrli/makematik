import type { Metadata } from "next";
import "./globals.css";
import PublicShell from "./components/PublicShell";

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
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <PublicShell>{children}</PublicShell>
      </body>
    </html>
  );
}
