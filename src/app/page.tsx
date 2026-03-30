const services = [
  {
    title: "Automatisation",
    description:
      "Éliminez les tâches répétitives. On connecte vos outils et on crée des workflows qui tournent tout seuls.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L6.75 2.906M12 21v-3m0-18v3" />
      </svg>
    ),
  },
  {
    title: "Apps sur mesure",
    description:
      "Des applications web taillées pour votre métier. Pas de logiciel générique, juste ce dont vous avez besoin.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    title: "Centralisation des données",
    description:
      "Fini les fichiers Excel éparpillés. On structure vos données dans un système unique et fiable.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75m16.5 3.75v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-6 py-32">
        <div className="max-w-3xl text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-sm text-accent-soft font-mono tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Outils numériques sur mesure
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight">
            Make
            <span className="text-accent">matik</span>
          </h1>

          <p className="text-xl sm:text-2xl text-foreground/60 leading-relaxed max-w-xl mx-auto">
            On fabrique vos outils métier.
          </p>

          <div className="pt-4">
            <a
              href="#contact"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-accent hover:bg-accent-soft text-white font-medium rounded-lg transition-colors duration-200"
            >
              Discuter de votre projet
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-sm font-mono text-accent-soft tracking-widest uppercase mb-12">
            Ce qu&apos;on fait
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {services.map((service) => (
              <div
                key={service.title}
                className="group p-6 rounded-xl bg-surface border border-border hover:border-accent/30 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  {service.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
                <p className="text-foreground/50 text-sm leading-relaxed">
                  {service.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-foreground/40">
          <span className="font-mono">
            Make<span className="text-accent/60">matik</span>
          </span>
          <span>&copy; 2026</span>
        </div>
      </footer>
    </>
  );
}
