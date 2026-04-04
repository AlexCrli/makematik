"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { useAppContext } from "../context";

interface CompanyCard {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
  gmail_connected: boolean;
  gmail_email: string | null;
  logo_url: string | null;
}

async function getToken() {
  if (!supabaseBrowser) return null;
  return (await supabaseBrowser.auth.getSession()).data.session?.access_token ?? null;
}

export default function SettingsPage() {
  const { role } = useAppContext();
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (role === "tech") { router.replace("/app/planning"); return; }
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch("/api/settings/companies", { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        setCompanies(json.companies ?? []);
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, [role, router]);

  async function handleCreate() {
    setCreating(true);
    const token = await getToken();
    if (!token) { setCreating(false); return; }
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: "Nouvelle marque", code: "NEW" }),
      });
      const json = await res.json();
      if (res.ok && json.company) {
        router.push(`/app/settings/${json.company.id}`);
      }
    } catch { /* empty */ }
    setCreating(false);
  }

  function initials(name: string): string {
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Ajouter une marque
        </button>
      </div>

      <h2 className="text-lg font-semibold text-gray-700 mb-4">Mes marques</h2>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-20 text-gray-400">Aucune marque configurée</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/app/settings/${c.id}`)}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                {c.logo_url ? (
                  <img src={c.logo_url} alt={c.name} className="w-10 h-10 rounded-lg object-contain" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: c.color || "#6366f1" }}
                  >
                    {initials(c.name)}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-gray-900">{c.name}</div>
                  {c.code && <span className="text-xs text-gray-400">{c.code}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {c.color && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />}
                {c.gmail_connected ? (
                  <span className="text-green-600">{c.gmail_email ?? "Gmail connecté"}</span>
                ) : (
                  <span className="text-gray-400">Gmail non connecté</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
