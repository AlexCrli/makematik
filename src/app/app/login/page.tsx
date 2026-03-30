"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!supabaseBrowser) {
      console.error("[login] supabaseBrowser is null — env vars missing?", {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "missing",
      });
      setError("Connexion au serveur indisponible. Réessayez plus tard.");
      setLoading(false);
      return;
    }

    console.log("[login] Calling signInWithPassword…", { email });

    const { data, error: authError } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    });

    console.log("[login] Auth result:", { data, authError });

    if (authError) {
      console.error("[login] Auth error:", authError.message, authError.status);
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }

    console.log("[login] Success, redirecting to /app…");
    window.location.href = "/app";
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <span className="text-3xl font-bold tracking-tight text-white">
            Make<span className="text-[#6366f1]">matik</span>
          </span>
          <p className="text-[#e5e5e5]/50 text-sm mt-2">Espace client</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-[#141414] border border-[#262626] p-8">
          <h1 className="text-xl font-semibold text-white mb-6">Connexion</h1>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#e5e5e5]/70 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-[#262626] text-white placeholder:text-[#e5e5e5]/30 focus:outline-none focus:border-[#6366f1]/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#e5e5e5]/70 mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-[#0a0a0a] border border-[#262626] text-white placeholder:text-[#e5e5e5]/30 focus:outline-none focus:border-[#6366f1]/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                placeholder="Votre mot de passe"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-50 text-white font-medium rounded-lg transition-colors duration-200"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
