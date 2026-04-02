"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { NewFollowUpModal } from "./prospects/FollowUpModal";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Stats {
  prospects_this_month: number;
  devis_en_attente: number;
  rdv_confirmes: number;
  factures_pending?: number;
  factures_pending_amount?: number;
  factures_overdue?: number;
}

interface RelanceClient {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  city: string | null;
  status: string;
  next_contact_date: string | null;
  company_name: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "Nouveau", color: "bg-blue-100 text-blue-700" },
  to_recall: { label: "À rappeler", color: "bg-orange-100 text-orange-700" },
  quote_sent: { label: "Devis envoyé", color: "bg-purple-100 text-purple-700" },
  rdv_confirmed: { label: "RDV confirmé", color: "bg-green-100 text-green-700" },
  client: { label: "Client", color: "bg-teal-100 text-teal-700" },
  lost: { label: "Perdu", color: "bg-red-100 text-red-700" },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function getToken() {
  if (!supabaseBrowser) return null;
  const session = (await supabaseBrowser.auth.getSession()).data.session;
  return session?.access_token ?? null;
}

function statusBadge(status: string) {
  const s = STATUS_LABELS[status] ?? { label: status, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [stats, setStats] = useState<Stats>({ prospects_this_month: 0, devis_en_attente: 0, rdv_confirmes: 0 });
  const [relances, setRelances] = useState<RelanceClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [followUpClientId, setFollowUpClientId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    // Fetch profile + stats + relances in parallel
    const headers = { Authorization: `Bearer ${token}` };
    const [profileRes, statsRes, relancesRes] = await Promise.all([
      fetch("/api/profile", { headers }),
      fetch("/api/dashboard/stats", { headers }),
      fetch("/api/dashboard/relances", { headers }),
    ]);

    if (profileRes.ok) {
      const pJson = await profileRes.json();
      if (pJson.profile?.full_name) setFirstName(pJson.profile.full_name.split(" ")[0]);
    }

    if (statsRes.ok) {
      const json = await statsRes.json();
      setStats(json);
    }
    if (relancesRes.ok) {
      const json = await relancesRes.json();
      setRelances(json.relances ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpis = [
    {
      label: "Prospects ce mois",
      value: stats.prospects_this_month,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
      color: "#6366f1",
    },
    {
      label: "Devis en attente",
      value: stats.devis_en_attente,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
      color: "#f59e0b",
    },
    {
      label: "RDV confirmés",
      value: stats.rdv_confirmes,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
      color: "#10b981",
    },
    {
      label: "Factures en attente",
      value: stats.factures_pending ?? 0,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
        </svg>
      ),
      color: "#f59e0b",
      href: "/app/stats",
    },
    {
      label: "Paiements en retard",
      value: stats.factures_overdue ?? 0,
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      ),
      color: (stats.factures_overdue ?? 0) > 0 ? "#ef4444" : "#9ca3af",
      href: "/app/stats",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        Bienvenue{firstName ? `, ${firstName}` : ""}
      </h1>

      {/* KPI cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpis.map((kpi) => {
          const Tag = (kpi as { href?: string }).href ? "button" : "div";
          return (
            <Tag
              key={kpi.label}
              className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-left ${(kpi as { href?: string }).href ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
              onClick={(kpi as { href?: string }).href ? () => router.push((kpi as { href?: string }).href!) : undefined}
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${kpi.color}15`, color: kpi.color }}
                >
                  {kpi.icon}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
              <div className="text-sm text-gray-500 mt-1">{kpi.label}</div>
            </Tag>
          );
        })}
      </div>

      {/* Prospects à relancer */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Prospects à relancer aujourd&apos;hui
          <span className="ml-2 text-sm font-normal text-gray-400">({relances.length})</span>
        </h2>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : relances.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-400 text-sm">Aucune relance à faire aujourd&apos;hui</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <table className="w-full hidden md:table">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Nom</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Téléphone</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Ville</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Société</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Statut</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {relances.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/app/prospects/${c.id}`)}
                    >
                      <td className="px-6 py-3.5 text-sm font-medium text-gray-900">
                        {c.first_name} {c.last_name}
                      </td>
                      <td className="px-6 py-3.5 text-sm text-gray-600">{c.phone ?? "—"}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-600">{c.city ?? "—"}</td>
                      <td className="px-6 py-3.5 text-sm text-gray-600">{c.company_name}</td>
                      <td className="px-6 py-3.5">{statusBadge(c.status)}</td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFollowUpClientId(c.id);
                          }}
                          className="text-xs font-medium text-[#6366f1] hover:text-[#818cf8] transition-colors"
                        >
                          Relancer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-50">
                {relances.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => router.push(`/app/prospects/${c.id}`)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 text-sm">
                        {c.first_name} {c.last_name}
                      </span>
                      {statusBadge(c.status)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {c.company_name} · {c.phone ?? "—"} · {c.city ?? "—"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFollowUpClientId(c.id);
                        }}
                        className="text-xs font-medium text-[#6366f1]"
                      >
                        Relancer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Follow-up modal */}
      {followUpClientId && (
        <NewFollowUpModal
          clientId={followUpClientId}
          onClose={() => setFollowUpClientId(null)}
          onCreated={() => { setFollowUpClientId(null); fetchData(); }}
        />
      )}
    </div>
  );
}
