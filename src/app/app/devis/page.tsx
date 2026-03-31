"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { useAppContext } from "../context";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Quote {
  id: string;
  quote_number: string;
  client_id: string;
  client_name: string;
  company_name: string;
  total_ttc: number;
  status: string;
  created_at: string;
}

const QUOTE_STATUSES = [
  { key: "all", label: "Tous" },
  { key: "draft", label: "Brouillon", color: "bg-gray-100 text-gray-700" },
  { key: "sent", label: "Envoyé", color: "bg-blue-100 text-blue-700" },
  { key: "accepted", label: "Accepté", color: "bg-green-100 text-green-700" },
  { key: "refused", label: "Refusé", color: "bg-red-100 text-red-700" },
  { key: "expired", label: "Expiré", color: "bg-orange-100 text-orange-700" },
];

function statusBadge(status: string) {
  const s = QUOTE_STATUSES.find((st) => st.key === status);
  const color = s?.color ?? "bg-gray-100 text-gray-600";
  const label = s?.label ?? status;
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function DevisListPage() {
  const { companies } = useAppContext();
  const router = useRouter();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");

  const fetchQuotes = useCallback(async () => {
    if (!supabaseBrowser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const session = (await supabaseBrowser.auth.getSession()).data.session;
    if (!session) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/quotes", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      setQuotes(json.quotes ?? []);
    } catch {
      setQuotes([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const filtered = quotes.filter((q) => {
    if (filterCompany !== "all" && q.company_name !== companies.find((c) => c.id === filterCompany)?.name) return false;
    if (activeStatus !== "all" && q.status !== activeStatus) return false;
    return true;
  });

  const statusCounts: Record<string, number> = { all: quotes.length };
  for (const q of quotes) {
    statusCounts[q.status] = (statusCounts[q.status] ?? 0) + 1;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Devis{" "}
            <span className="text-base font-normal text-gray-400">
              ({quotes.length})
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-[#6366f1]/50 focus:ring-2 focus:ring-[#6366f1]/10 transition-all"
          >
            <option value="all">Toutes les sociétés</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={() => router.push("/app/devis/nouveau")}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-medium rounded-lg transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouveau devis
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-1 px-4 pt-3 pb-0 overflow-x-auto">
          {QUOTE_STATUSES.map((s) => {
            const count = statusCounts[s.key] ?? 0;
            const active = activeStatus === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActiveStatus(s.key)}
                className={`shrink-0 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  active
                    ? "border-[#6366f1] text-[#6366f1]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {s.label}
                <span className={`ml-1.5 text-xs ${active ? "text-[#6366f1]" : "text-gray-400"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table — desktop */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-gray-400 text-sm">Aucun devis pour le moment</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Numéro</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Client</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Société</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Montant TTC</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Statut</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Date</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((q) => (
                <tr
                  key={q.id}
                  className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/app/devis/${q.id}`)}
                >
                  <td className="px-6 py-3.5 text-sm font-medium text-gray-900">{q.quote_number}</td>
                  <td className="px-6 py-3.5 text-sm text-gray-600">{q.client_name}</td>
                  <td className="px-6 py-3.5 text-sm text-gray-600">{q.company_name}</td>
                  <td className="px-6 py-3.5 text-sm font-medium text-gray-900">{formatCurrency(q.total_ttc)}</td>
                  <td className="px-6 py-3.5">{statusBadge(q.status)}</td>
                  <td className="px-6 py-3.5 text-sm text-gray-600">
                    {new Date(q.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/app/devis/${q.id}`);
                      }}
                      className="text-xs font-medium text-[#6366f1] hover:text-[#818cf8] transition-colors"
                    >
                      Voir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cards — mobile */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 text-center py-16">
            <p className="text-gray-400 text-sm">Aucun devis pour le moment</p>
          </div>
        ) : (
          filtered.map((q) => (
            <div
              key={q.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2"
              onClick={() => router.push(`/app/devis/${q.id}`)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 text-sm">{q.quote_number}</span>
                {statusBadge(q.status)}
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{q.client_name}</span>
                <span>{q.company_name}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-medium text-gray-900">{formatCurrency(q.total_ttc)}</span>
                <span className="text-xs text-gray-400">
                  {new Date(q.created_at).toLocaleDateString("fr-FR")}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
