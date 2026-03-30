import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "À propos — Makematik",
  description:
    "Découvrez Alex Carlier, le créateur derrière Makematik. Automatisation, outils métier et solutions sur mesure pour TPE/PME.",
};

const skills = [
  "Power Platform",
  "Next.js",
  "Supabase",
  "n8n",
  "Automatisation",
  "IA",
];

export default function APropos() {
  return (
    <section className="px-6 py-24 sm:py-32">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-16">
          Derrière Makematik
        </h1>

        <div className="flex flex-col sm:flex-row items-start gap-10">
          {/* Photo placeholder */}
          <div className="shrink-0 w-28 h-28 rounded-full bg-surface border border-border flex items-center justify-center">
            <span className="text-2xl font-bold text-accent">AC</span>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Alex Carlier</h2>

            <div className="space-y-4 text-foreground/60 leading-relaxed">
              <p>
                Passionné d&apos;automatisation et créateur d&apos;outils
                numériques. Avant de lancer Makematik, j&apos;étais vendeur chez
                Cultura. C&apos;est là que j&apos;ai vu de l&apos;intérieur les
                problèmes d&apos;organisation des entreprises — les process
                manuels, les données éparpillées, le temps perdu sur des tâches
                qui pourraient tourner toutes seules.
              </p>
              <p>
                J&apos;ai commencé à construire des solutions en interne, et
                j&apos;ai vite réalisé que beaucoup de TPE/PME avaient
                exactement les mêmes besoins. Makematik est né de cette envie :
                créer des outils sur mesure qui simplifient le quotidien des
                équipes.
              </p>
              <p>
                Mon approche est simple : comprendre votre métier avant de
                toucher au code. Chaque outil est pensé pour s&apos;intégrer
                dans votre façon de travailler, pas l&apos;inverse.
              </p>
            </div>

            {/* Compétences */}
            <div className="pt-4">
              <h3 className="text-sm font-mono text-accent-soft tracking-widest uppercase mb-4">
                Compétences
              </h3>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 rounded-full text-xs font-mono bg-accent/10 text-accent border border-accent/20"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 pt-12 border-t border-border text-center space-y-6">
          <h2 className="text-2xl font-bold">Envie de travailler ensemble ?</h2>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-accent hover:bg-accent-soft text-white font-medium rounded-lg transition-colors duration-200"
          >
            Me contacter
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
