"use client";

import { useState } from "react";

const needOptions = [
  "Gestion de prospects / clients",
  "Relances automatiques",
  "Création de devis",
  "Facturation",
  "Suivi de commandes",
  "Statistiques de l'activité",
  "Centralisation des données",
  "Planning / gestion d'interventions",
  "Autre",
];

const budgetOptions = [
  "Moins de 1000€",
  "1000€ - 2000€",
  "Plus de 2000€",
  "Je ne sais pas encore",
];

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [needs, setNeeds] = useState<string[]>([]);
  const [otherNeed, setOtherNeed] = useState("");

  function toggleNeed(need: string) {
    setNeeds((prev) =>
      prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);

    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone") || null,
      company: form.get("company"),
      sector: form.get("sector") || null,
      needs: needs.includes("Autre")
        ? [...needs.filter((n) => n !== "Autre"), otherNeed].filter(Boolean)
        : needs,
      description: form.get("description"),
      features: form.get("features") || null,
      budget: form.get("budget"),
    };

    try {
      await fetch("/api/prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      // proceed anyway
    }

    setSubmitted(true);
    setSending(false);
  }

  if (submitted) {
    return (
      <section className="px-6 py-24 sm:py-32">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-surface to-surface p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-2">
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-accent">Merci !</h2>
            <p className="text-foreground/60 text-lg">
              Votre demande a bien été envoyée.<br />
              On revient vers vous sous 48h.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 py-24 sm:py-32">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Décrivez-nous votre besoin
        </h1>
        <p className="text-foreground/50 text-lg leading-relaxed mb-14">
          Remplissez ce formulaire, on revient vers vous sous 48h avec une
          proposition adaptée.
        </p>

        <form onSubmit={handleSubmit} className="space-y-14">
          {/* Section 1 — Coordonnées */}
          <fieldset className="space-y-6">
            <legend className="text-sm font-mono text-accent-soft tracking-widest uppercase mb-6">
              Vos coordonnées
            </legend>

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Nom complet <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                  placeholder="Jean Dupont"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email <span className="text-accent">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                  placeholder="jean@entreprise.fr"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium mb-2">
                  Téléphone{" "}
                  <span className="text-foreground/30 font-normal">(optionnel)</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                  placeholder="06 12 34 56 78"
                />
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-medium mb-2">
                  Nom de l&apos;entreprise <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  required
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                  placeholder="Mon Entreprise SARL"
                />
              </div>
            </div>

            <div>
              <label htmlFor="sector" className="block text-sm font-medium mb-2">
                Secteur d&apos;activité
              </label>
              <input
                type="text"
                id="sector"
                name="sector"
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                placeholder="Climatisation, Plomberie, Commerce..."
              />
            </div>
          </fieldset>

          {/* Section 2 — Besoins */}
          <fieldset className="space-y-6">
            <legend className="text-sm font-mono text-accent-soft tracking-widest uppercase mb-6">
              De quoi avez-vous besoin ?
            </legend>

            <div className="grid sm:grid-cols-2 gap-3">
              {needOptions.map((option) => {
                const selected = needs.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleNeed(option)}
                    className={`relative flex items-center gap-3 px-4 py-3.5 rounded-lg border text-left text-sm transition-all duration-200 ${
                      selected
                        ? "border-accent/50 bg-accent/10 text-foreground shadow-[0_0_0_1px_rgba(99,102,241,0.3)]"
                        : "border-border bg-surface text-foreground/60 hover:border-accent/30 hover:bg-surface-hover"
                    }`}
                  >
                    <span
                      className={`shrink-0 w-5 h-5 rounded flex items-center justify-center border transition-all duration-200 ${
                        selected
                          ? "bg-accent border-accent"
                          : "border-border bg-transparent"
                      }`}
                    >
                      {selected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>

            {needs.includes("Autre") && (
              <div className="mt-3">
                <input
                  type="text"
                  value={otherNeed}
                  onChange={(e) => setOtherNeed(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-surface border border-accent/30 text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                  placeholder="Décrivez votre besoin..."
                />
              </div>
            )}
          </fieldset>

          {/* Section 3 — Projet */}
          <fieldset className="space-y-6">
            <legend className="text-sm font-mono text-accent-soft tracking-widest uppercase mb-6">
              Votre projet
            </legend>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-2">
                Décrivez votre activité et comment vous gérez vos processus
                aujourd&apos;hui <span className="text-accent">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all resize-none"
                placeholder="Ex: Je suis plombier, je gère mes rendez-vous sur papier et mes devis sur Word..."
              />
            </div>

            <div>
              <label htmlFor="features" className="block text-sm font-medium mb-2">
                Y a-t-il des fonctionnalités spécifiques que vous aimeriez avoir ?{" "}
                <span className="text-foreground/30 font-normal">(optionnel)</span>
              </label>
              <textarea
                id="features"
                name="features"
                rows={3}
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all resize-none"
                placeholder="Ex: J'aimerais pouvoir envoyer des relances par SMS automatiquement..."
              />
            </div>
          </fieldset>

          {/* Section 4 — Budget */}
          <fieldset className="space-y-6">
            <legend className="text-sm font-mono text-accent-soft tracking-widest uppercase mb-6">
              Budget
            </legend>

            <div>
              <label htmlFor="budget" className="block text-sm font-medium mb-2">
                Budget envisagé
              </label>
              <select
                id="budget"
                name="budget"
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-foreground focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all appearance-none"
                defaultValue=""
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                }}
              >
                <option value="" disabled>
                  Sélectionnez une fourchette
                </option>
                {budgetOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>

          {/* Submit */}
          <button
            type="submit"
            disabled={sending}
            className="w-full px-8 py-4 bg-accent hover:bg-accent-soft disabled:opacity-50 text-white font-medium rounded-lg transition-colors duration-200 text-lg"
          >
            {sending ? "Envoi en cours..." : "Envoyer ma demande"}
          </button>
        </form>
      </div>
    </section>
  );
}
