"use client";

import type { FormEvent } from "react";
import { useState } from "react";

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    console.log("Contact form:", data);
    setSubmitted(true);
  }

  return (
    <section className="px-6 py-24 sm:py-32">
      <div className="max-w-xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Contact
        </h1>
        <p className="text-foreground/50 text-lg leading-relaxed mb-12">
          Un process qui vous ralentit ? Un outil qui vous manque ? Décrivez-nous
          votre besoin, on revient vers vous sous 48h.
        </p>

        {submitted ? (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-8 text-center space-y-3">
            <div className="text-accent text-2xl font-bold">Merci !</div>
            <p className="text-foreground/60">
              Votre message a bien été envoyé. On revient vers vous très vite.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Nom
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 transition-colors"
                placeholder="Votre nom"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 transition-colors"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label
                htmlFor="company"
                className="block text-sm font-medium mb-2"
              >
                Entreprise{" "}
                <span className="text-foreground/30 font-normal">
                  (optionnel)
                </span>
              </label>
              <input
                type="text"
                id="company"
                name="company"
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 transition-colors"
                placeholder="Nom de votre entreprise"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium mb-2"
              >
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={5}
                className="w-full px-4 py-3 rounded-lg bg-surface border border-border text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-accent/50 transition-colors resize-none"
                placeholder="Décrivez votre besoin..."
              />
            </div>

            <button
              type="submit"
              className="w-full px-8 py-3.5 bg-accent hover:bg-accent-soft text-white font-medium rounded-lg transition-colors duration-200"
            >
              Envoyer
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
