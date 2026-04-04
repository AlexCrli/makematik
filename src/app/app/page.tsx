"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { NewFollowUpModal } from "./prospects/FollowUpModal";
import { useAppContext } from "./context";

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
  ca_this_month?: number;
  ca_last_month?: number;
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

interface UpcomingIntervention {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  assigned_to: string;
  assignee_name: string | null;
  company_id: string | null;
  client: {
    first_name: string;
    last_name: string;
    city: string | null;
  } | null;
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

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function todayStr(): string {
  const n = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

function fmtDateFr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const months = ["janv.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const router = useRouter();
  const { companies } = useAppContext();
  const [firstName, setFirstName] = useState("");
  const [stats, setStats] = useState<Stats>({ prospects_this_month: 0, devis_en_attente: 0, rdv_confirmes: 0 });
  const [relances, setRelances] = useState<RelanceClient[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingIntervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [followUpClientId, setFollowUpClientId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    const headers = { Authorization: `Bearer ${token}` };
    const today = todayStr();
    const [profileRes, statsRes, relancesRes, ivRes] = await Promise.all([
      fetch("/api/profile", { headers }),
      fetch("/api/dashboard/stats", { headers }),
      fetch("/api/dashboard/relances", { headers }),
      fetch(`/api/interventions?status=planned&start_date=${today}`, { headers }),
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
    if (ivRes.ok) {
      const json = await ivRes.json();
      setUpcoming((json.interventions ?? []).slice(0, 5));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // CA comparison
  const caThisMonth = stats.ca_this_month ?? 0;
  const caLastMonth = stats.ca_last_month ?? 0;
  const caDelta = caLastMonth > 0 ? ((caThisMonth - caLastMonth) / caLastMonth) * 100 : null;

  const pendingCount = stats.factures_pending ?? 0;
  const overdueCount = stats.factures_overdue ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        Bienvenue{firstName ? `, ${firstName}` : ""}
      </h1>

      {/* KPI cards — 4 cards in a row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Prospects ce mois */}
        <div className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <span className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#6366f115", color: "#6366f1" }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.prospects_this_month}</div>
          <div className="text-sm text-gray-500 mt-1">Prospects ce mois</div>
        </div>

        {/* Devis en attente */}
        <div className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <span className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#f59e0b15", color: "#f59e0b" }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.devis_en_attente}</div>
          <div className="text-sm text-gray-500 mt-1">Devis en attente</div>
        </div>

        {/* RDV confirmés */}
        <div className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <span className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#10b98115", color: "#10b981" }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.rdv_confirmes}</div>
          <div className="text-sm text-gray-500 mt-1">RDV confirmés</div>
        </div>

        {/* Factures (merged) */}
        <button
          onClick={() => router.push("/app/factures")}
          className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100 text-left cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#f59e0b15", color: "#f59e0b" }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
              </svg>
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{pendingCount}</div>
          <div className="text-sm text-gray-500 mt-1">
            {pendingCount} en attente{" "}
            {overdueCount > 0 ? (
              <span className="text-red-500 font-medium">· {overdueCount} en retard</span>
            ) : (
              <span>· 0 en retard</span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">Factures</div>
        </button>
      </div>

      {/* CA du mois */}
      <div className="mt-4 bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#10b98115", color: "#10b981" }}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <div>
            <div className="text-lg font-bold text-gray-900">CA ce mois : {fmtEur(caThisMonth)}</div>
            {caDelta !== null && (
              <span className={`text-sm font-medium ${caDelta >= 0 ? "text-green-600" : "text-red-500"}`}>
                {caDelta >= 0 ? "+" : ""}{caDelta.toFixed(0)} % vs mois précédent
              </span>
            )}
            {caDelta === null && caThisMonth > 0 && (
              <span className="text-sm text-gray-400">Pas de données le mois dernier</span>
            )}
          </div>
        </div>
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

      {/* Prochaines interventions */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Prochaines interventions
            <span className="ml-2 text-sm font-normal text-gray-400">({upcoming.length})</span>
          </h2>
          <button onClick={() => router.push("/app/interventions")} className="text-sm font-medium text-[#6366f1] hover:text-[#818cf8] transition-colors">
            Voir tout &rarr;
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : upcoming.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <p className="text-gray-400 text-sm">Aucune intervention planifiée</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <table className="w-full hidden md:table">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Date</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Client</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Ville</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Société</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Intervenant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {upcoming.map((iv) => {
                    const companyName = iv.company_id ? companies.find((c) => c.id === iv.company_id)?.name : null;
                    const clientName = iv.client ? `${iv.client.first_name} ${iv.client.last_name}` : "—";
                    return (
                      <tr
                        key={iv.id}
                        className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/app/interventions/${iv.id}`)}
                      >
                        <td className="px-6 py-3.5 text-sm text-gray-900 font-medium whitespace-nowrap">
                          {fmtDateFr(iv.scheduled_date)} à {iv.scheduled_time.slice(0, 5)}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-700">{clientName}</td>
                        <td className="px-6 py-3.5 text-sm text-gray-600">{iv.client?.city ?? "—"}</td>
                        <td className="px-6 py-3.5">
                          {companyName ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700">{companyName}</span>
                          ) : "—"}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-600">{iv.assignee_name ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-50">
                {upcoming.map((iv) => {
                  const companyName = iv.company_id ? companies.find((c) => c.id === iv.company_id)?.name : null;
                  const clientName = iv.client ? `${iv.client.first_name} ${iv.client.last_name}` : "—";
                  return (
                    <div
                      key={iv.id}
                      className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                      onClick={() => router.push(`/app/interventions/${iv.id}`)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900 text-sm">{clientName}</span>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{fmtDateFr(iv.scheduled_date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{iv.scheduled_time.slice(0, 5)}</span>
                        {iv.client?.city && <span>· {iv.client.city}</span>}
                        {companyName && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700">{companyName}</span>
                        )}
                        {iv.assignee_name && <span>· {iv.assignee_name}</span>}
                      </div>
                    </div>
                  );
                })}
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
