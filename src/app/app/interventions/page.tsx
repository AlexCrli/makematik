"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { useAppContext } from "../context";

interface ClientInfo {
  first_name: string;
  last_name: string;
  city: string | null;
  nb_splits: number | null;
  company_id: string | null;
}

interface InterventionItem {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  status: string;
  assigned_to: string;
  client: ClientInfo | null;
  assignee_name: string | null;
}

const DAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  planned: { label: "Planifié", bg: "bg-blue-100", text: "text-blue-700" },
  in_progress: { label: "En cours", bg: "bg-orange-100", text: "text-orange-700" },
};

function formatDateFr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS_FR[date.getDay()]} ${d} ${MONTHS_FR[date.getMonth()]}`;
}

function formatTime(timeStr: string): string {
  const h = parseInt(timeStr.slice(0, 2));
  const m = timeStr.slice(3, 5);
  return `${h}h${m === "00" ? "" : m}`;
}

export default function InterventionsListPage() {
  const { companies, role } = useAppContext();
  const router = useRouter();
  const [interventions, setInterventions] = useState<InterventionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!supabaseBrowser) return;
      const session = (await supabaseBrowser.auth.getSession()).data.session;
      if (!session) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const userId = session.user.id;

      let url = "/api/interventions?status=planned,in_progress";
      if (role === "tech") {
        url += `&assigned_to=${userId}`;
      }

      try {
        const res = await fetch(url, { headers });
        const json = await res.json();
        setInterventions(json.interventions ?? []);
      } catch {
        setInterventions([]);
      }
      setLoading(false);
    })();
  }, [role]);

  function getCompanyName(companyId: string | null | undefined): string | null {
    if (!companyId) return null;
    return companies.find((c) => c.id === companyId)?.name ?? null;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Interventions</h1>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : interventions.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          Aucune intervention à venir
        </div>
      ) : (
        <div className="space-y-3">
          {interventions.map((iv) => {
            const status = STATUS_MAP[iv.status] ?? STATUS_MAP.planned;
            const companyName = getCompanyName(iv.client?.company_id);
            return (
              <button
                key={iv.id}
                onClick={() => router.push(`/app/interventions/${iv.id}`)}
                className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:shadow-md active:bg-gray-50 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-base font-semibold text-gray-900">
                      {formatDateFr(iv.scheduled_date)} — {formatTime(iv.scheduled_time)}
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">
                      {iv.client ? `${iv.client.first_name} ${iv.client.last_name}` : "—"}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text} shrink-0`}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-sm text-gray-500">
                  {iv.client?.city && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      {iv.client.city}
                    </span>
                  )}
                  {iv.client?.nb_splits != null && (
                    <span className="text-gray-400">·</span>
                  )}
                  {iv.client?.nb_splits != null && (
                    <span>{iv.client.nb_splits} splits</span>
                  )}
                  {iv.assignee_name && (
                    <>
                      <span className="text-gray-400">·</span>
                      <span>{iv.assignee_name}</span>
                    </>
                  )}
                </div>
                {companyName && (
                  <div className="mt-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                      {companyName}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
