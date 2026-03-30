import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Réalisations — Makematik",
  description:
    "Découvrez les projets réalisés par Makematik : automatisation, apps métier et centralisation de données pour TPE/PME.",
};

const projects = [
  {
    client: "CEC — Cultura Sorgues",
    logo: "/cultura-logo.png",
    logoAlt: "Cultura Sorgues",
    context:
      "Le rayon Service de Cultura Sorgues gérait les commandes fournisseurs pour les clients professionnels à la main — Excel, emails, papier. Chaque commande passait par plusieurs allers-retours, avec un risque d'erreur à chaque étape.",
    solution:
      "Application complète sur Power Platform qui digitalise tout le workflow : réception des devis fournisseurs avec scan PDF et extraction automatique via AI Builder, passation de commande, suivi des livraisons et notifications automatiques à chaque étape.",
    result:
      "Workflow automatisé à 80%. Déploiement validé par l'IT du groupe, en production.",
    stack: ["PowerApps", "Power Automate", "SharePoint", "AI Builder"],
  },
  {
    client: "NetVapeur",
    logo: "/netvapeur-logo.webp",
    logoAlt: "NetVapeur",
    context:
      "Entreprise de nettoyage et maintenance de climatisations. La gestion des interventions, des devis et du suivi clients se faisait de manière artisanale — beaucoup de temps perdu en administratif.",
    solution:
      "Outil interne sur mesure pour centraliser la gestion des interventions, automatiser la génération de devis et assurer un suivi client rigoureux sans effort supplémentaire.",
    result: null,
    stack: ["Outils internes personnalisés"],
  },
];

export default function Realisations() {
  return (
    <>
      <section className="px-6 py-24 sm:py-32">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Réalisations
          </h1>
          <p className="text-foreground/50 text-lg max-w-2xl mb-16">
            Des outils concrets, construits pour résoudre des problèmes réels.
            Voici quelques projets livrés.
          </p>

          <div className="space-y-8">
            {projects.map((project) => (
              <article
                key={project.client}
                className="rounded-xl border border-border bg-surface p-8 sm:p-10 space-y-6"
              >
                <div className={`inline-block ${project.logo === "/netvapeur-logo.webp" ? "bg-white rounded-lg px-5 py-3" : ""}`}>
                  <Image
                    src={project.logo}
                    alt={project.logoAlt}
                    width={200}
                    height={80}
                    className="object-contain"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-sm font-mono text-accent-soft tracking-widest uppercase mb-3">
                      Contexte
                    </h3>
                    <p className="text-foreground/60 text-sm leading-relaxed">
                      {project.context}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-mono text-accent-soft tracking-widest uppercase mb-3">
                      Solution
                    </h3>
                    <p className="text-foreground/60 text-sm leading-relaxed">
                      {project.solution}
                    </p>
                  </div>
                </div>

                {project.result && (
                  <div className="pt-2">
                    <h3 className="text-sm font-mono text-accent-soft tracking-widest uppercase mb-3">
                      Résultat
                    </h3>
                    <p className="text-foreground/60 text-sm leading-relaxed">
                      {project.result}
                    </p>
                  </div>
                )}

                <div className="pt-2 flex flex-wrap gap-2">
                  {project.stack.map((tech) => (
                    <span
                      key={tech}
                      className="px-3 py-1 rounded-full text-xs font-mono bg-accent/10 text-accent border border-accent/20"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-2xl font-bold">
            Votre projet pourrait être le prochain.
          </h2>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-accent hover:bg-accent-soft text-white font-medium rounded-lg transition-colors duration-200"
          >
            Parlons de votre besoin
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  );
}
