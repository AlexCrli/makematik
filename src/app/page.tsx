import Image from "next/image";
import Link from "next/link";
import FadeIn from "./components/FadeIn";

const services = [
  {
    title: "Gestion de vos prospects",
    description:
      "Fini les contacts notés sur un carnet ou perdus dans vos mails. On vous crée un outil simple pour centraliser vos prospects, suivre vos relances et ne plus laisser filer d'opportunités.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2.25 2.25 0 013 16.878V15.12a9.001 9.001 0 0112-8.456M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0112.75 0v.109zM12 9.75a3 3 0 10-6 0 3 3 0 006 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    title: "Devis, factures & relances",
    description:
      "Générez vos devis en quelques clics, transformez-les en factures, et laissez l'outil relancer automatiquement vos clients. Vous vous concentrez sur votre métier, pas sur la paperasse.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    title: "Suivi d'activité centralisé",
    description:
      "Vos chiffres, vos commandes, vos stats — tout au même endroit. Plus besoin de jongler entre Excel, mails et post-it. Vous ouvrez votre app et vous savez où vous en êtes.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
];

const steps = [
  {
    number: "01",
    title: "On discute de votre quotidien",
    description:
      "Un appel de 30 minutes pour comprendre comment vous travaillez aujourd'hui : vos outils, vos galères, ce qui vous prend du temps.",
  },
  {
    number: "02",
    title: "On crée votre outil",
    description:
      "En quelques jours, on développe votre application sur mesure. Vous testez, on ajuste — jusqu'à ce que ça colle parfaitement à votre façon de travailler.",
  },
  {
    number: "03",
    title: "Vous vous connectez et c'est prêt",
    description:
      "Votre outil est en ligne. Vous vous connectez, tout est là : vos clients, vos devis, vos stats. Vous gagnez des heures chaque semaine.",
  },
];

// Clients are rendered inline as SVG logos below

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="flex items-center justify-center px-6 py-32 sm:py-40">
        <div className="max-w-3xl text-center space-y-8">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 text-sm text-accent-soft font-mono tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Applications métier sur mesure
            </div>
          </FadeIn>

          <FadeIn delay={100}>
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.1]">
              Make
              <span className="text-accent">matik</span>
            </h1>
          </FadeIn>

          <FadeIn delay={200}>
            <p className="text-lg sm:text-xl text-foreground/60 leading-relaxed max-w-2xl mx-auto">
              Vous gérez vos devis, factures et relances à la main ? On vous crée votre application métier sur mesure, pour une fraction du prix d&apos;un développement classique.
            </p>
          </FadeIn>

          <FadeIn delay={300}>
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-accent hover:bg-accent-soft text-white font-medium rounded-lg transition-colors duration-200"
              >
                Discuter de votre projet
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link
                href="/realisations"
                className="inline-flex items-center gap-2 px-8 py-3.5 border border-border hover:border-accent/40 text-foreground/70 hover:text-foreground font-medium rounded-lg transition-all duration-200"
              >
                Voir nos réalisations
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Services */}
      <section className="px-6 py-28 bg-section-alt">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <h2 className="text-sm font-mono text-accent-soft tracking-widest uppercase mb-4">
              Ce qu&apos;on fait
            </h2>
            <p className="text-foreground/50 mb-12 max-w-xl">
              Des outils pensés pour les artisans et petits entrepreneurs qui veulent arrêter de tout gérer à la main.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6">
            {services.map((service, i) => (
              <FadeIn key={service.title} delay={i * 100}>
                <div className="group h-full p-7 rounded-xl bg-surface border border-border hover:border-accent/30 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-5 group-hover:bg-accent/20 transition-colors">
                    {service.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{service.title}</h3>
                  <p className="text-foreground/50 text-sm leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Video placeholder */}
      <section className="px-6 py-28 bg-section-alt2">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <div className="relative aspect-video rounded-2xl bg-surface border border-border overflow-hidden group cursor-pointer">
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-accent/5" />

              {/* Play button */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="w-20 h-20 rounded-full bg-accent/20 border-2 border-accent/40 flex items-center justify-center group-hover:bg-accent/30 group-hover:border-accent/60 transition-all duration-300 group-hover:scale-110">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-accent ml-1">
                    <path d="M8 5.14v14l11-7-11-7z" />
                  </svg>
                </div>
                <p className="text-foreground/60 text-sm font-medium">
                  Découvrez Makematik en 2 minutes
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Comment ca marche */}
      <section className="px-6 py-28">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <h2 className="text-sm font-mono text-accent-soft tracking-widest uppercase mb-4">
              Comment ça marche
            </h2>
            <p className="text-foreground/50 mb-12 max-w-xl">
              De l&apos;idée à l&apos;outil prêt à l&apos;emploi, en toute simplicité.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <FadeIn key={step.number} delay={i * 150}>
                <div className="relative">
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-accent/20 to-transparent -translate-x-4" />
                  )}
                  <div className="text-5xl font-bold text-accent/20 font-mono mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-foreground/50 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Prix — comparatif */}
      <section className="px-6 py-28 bg-section-alt">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="text-center mb-14">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                Pourquoi payer plus ?
              </h2>
              <p className="text-foreground/50 max-w-xl mx-auto">
                Comparez par vous-même : une application sur mesure pour votre métier, sans le budget d&apos;une agence.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={100}>
            <div className="grid sm:grid-cols-5 gap-6 items-start">
              {/* Makematik — 3 colonnes, mis en avant */}
              <div className="sm:col-span-3 p-8 sm:p-10 rounded-2xl relative overflow-hidden border-2 border-accent/40 bg-gradient-to-br from-accent/[0.07] via-surface to-surface shadow-[0_0_40px_-12px_rgba(99,102,241,0.25)]">
                {/* Badge recommandé */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-accent-soft to-accent" />
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-semibold mb-6">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                  Recommandé
                </div>

                <div className="mb-8">
                  <div className="text-sm font-mono text-accent-soft uppercase tracking-wide mb-2">Makematik</div>
                  <div className="text-4xl sm:text-5xl font-bold">
                    1 000 <span className="text-xl font-normal text-foreground/50">à</span> 2 000 &euro;
                  </div>
                  <p className="text-foreground/60 text-sm mt-2">Application livrée, prête à l&apos;emploi</p>
                </div>
                <ul className="space-y-4 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </span>
                    <span className="text-foreground/80">100% adapté à votre métier</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </span>
                    <span className="text-foreground/80">Livré en quelques jours</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </span>
                    <span className="text-foreground/80">Prise en main immédiate</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </span>
                    <span className="text-foreground/80">Accompagnement inclus</span>
                  </li>
                </ul>
              </div>

              {/* Dev classique — 2 colonnes, en retrait */}
              <div className="sm:col-span-2 p-6 rounded-2xl bg-surface/40 border border-border/50 opacity-60 relative overflow-hidden">
                <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_10px,rgba(255,255,255,0.01)_10px,rgba(255,255,255,0.01)_20px)]" />
                <div className="relative">
                  <div className="mb-6">
                    <div className="text-xs font-mono text-foreground/30 uppercase tracking-wide mb-2">Développement classique</div>
                    <div className="text-2xl sm:text-3xl font-bold text-foreground/25">
                      10 000 &euro;<span className="text-base font-normal">+</span>
                    </div>
                    <p className="text-foreground/25 text-xs mt-1">Agence ou freelance</p>
                  </div>
                  <ul className="space-y-3 text-xs text-foreground/30">
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-2.5 h-2.5 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </span>
                      Délais de plusieurs mois
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-2.5 h-2.5 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </span>
                      Cahier des charges complexe
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-2.5 h-2.5 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </span>
                      Budget imprévisible
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-2.5 h-2.5 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </span>
                      Maintenance coûteuse
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Confiance */}
      <section className="px-6 py-28 bg-section-alt2">
        <div className="max-w-5xl mx-auto text-center">
          <FadeIn>
            <h2 className="text-sm font-mono text-accent-soft tracking-widest uppercase mb-14">
              Ils nous ont fait confiance
            </h2>
          </FadeIn>

          <FadeIn delay={100}>
            <div className="flex flex-wrap items-center justify-center gap-14 sm:gap-20">
              {/* Logo Cultura */}
              <div className="opacity-70 hover:opacity-100 transition-opacity duration-300">
                <Image
                  src="/cultura-logo.png"
                  alt="Cultura Sorgues"
                  width={150}
                  height={60}
                  className="rounded-lg brightness-125 object-contain"
                />
              </div>

              {/* Logo NetVapeur */}
              <div className="opacity-70 hover:opacity-100 transition-opacity duration-300 bg-white rounded-lg px-5 py-3">
                <Image
                  src="/netvapeur-logo.webp"
                  alt="NetVapeur"
                  width={150}
                  height={60}
                  className="object-contain"
                />
              </div>

              {/* CTA — Votre entreprise */}
              <Link
                href="/contact"
                className="group opacity-50 hover:opacity-100 transition-all duration-300"
              >
                <div className="h-[60px] px-6 rounded-lg border border-dashed border-accent/30 group-hover:border-accent/60 flex items-center justify-center gap-2 transition-all duration-300">
                  <svg className="w-4 h-4 text-accent/50 group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  <span className="text-sm text-foreground/40 group-hover:text-foreground/70 transition-colors">Votre entreprise ?</span>
                </div>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-28">
        <FadeIn>
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold">
              Vous perdez du temps sur des tâches répétitives ?
            </h2>
            <p className="text-foreground/50 text-lg">Parlons-en.</p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-accent hover:bg-accent-soft text-white font-medium rounded-lg transition-colors duration-200"
            >
              Nous contacter
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </FadeIn>
      </section>
    </>
  );
}
