"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { useAppContext } from "../context";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DeferredInvoice {
  id: string;
  invoice_number: string;
  client_name: string | null;
  company_name: string | null;
  company_id: string;
  total_ttc: number;
  payment_due_date: string | null;
  late_fee_percentage: number;
}

interface PaidDeferredInvoice {
  id: string;
  invoice_number: string;
  client_name: string | null;
  total_ttc: number;
  payment_date: string | null;
  payment_method: string | null;
  late_fee_applied: boolean;
}

interface StatsData {
  total_ca: number;
  total_interventions: number;
  pending_count: number;
  pending_amount: number;
  ca_par_mois: Record<string, unknown>[];
  companies_map: Record<string, string>;
  repartition_paiement: { method: string; amount: number; count: number }[];
  factures_differees: DeferredInvoice[];
  factures_differees_reglees: PaidDeferredInvoice[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function getToken() {
  if (!supabaseBrowser) return null;
  return (await supabaseBrowser.auth.getSession()).data.session?.access_token ?? null;
}

const MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Espèces", check: "Chèque", card: "CB", deferred: "Différé", other: "Autre",
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: "#22c55e", check: "#3b82f6", card: "#8b5cf6", deferred: "#f97316", other: "#9ca3af",
};

const COMPANY_COLORS: Record<string, string> = {
  NetVapeur: "#2196F3", "Clim Eco Pro": "#00897B", Clim50: "#E65100",
};

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function todayStr(): string {
  const n = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

function getMonthStart(): string {
  const n = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-01`;
}

function getYearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}

const PERIOD_OPTIONS = [
  { label: "Ce mois", getRange: () => ({ start: getMonthStart(), end: todayStr() }) },
  { label: "Mois dernier", getRange: () => {
    const n = new Date();
    const prev = new Date(n.getFullYear(), n.getMonth() - 1, 1);
    const last = new Date(n.getFullYear(), n.getMonth(), 0);
    const pad = (v: number) => String(v).padStart(2, "0");
    return {
      start: `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-01`,
      end: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
    };
  }},
  { label: "Ce trimestre", getRange: () => {
    const n = new Date();
    const qStart = new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1);
    const pad = (v: number) => String(v).padStart(2, "0");
    return { start: `${qStart.getFullYear()}-${pad(qStart.getMonth() + 1)}-01`, end: todayStr() };
  }},
  { label: "Cette année", getRange: () => ({ start: getYearStart(), end: todayStr() }) },
  { label: "Personnalisé", getRange: () => null },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function StatsPage() {
  const { companies } = useAppContext();
  const router = useRouter();

  const [periodIdx, setPeriodIdx] = useState(0);
  const [customStart, setCustomStart] = useState(getMonthStart());
  const [customEnd, setCustomEnd] = useState(todayStr());
  const [companyFilter, setCompanyFilter] = useState("");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);


  const range = PERIOD_OPTIONS[periodIdx].getRange();
  const dateStart = range ? range.start : customStart;
  const dateEnd = range ? range.end : customEnd;

  const fetchStats = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ date_start: dateStart, date_end: dateEnd });
    if (companyFilter) params.set("company_id", companyFilter);
    try {
      const res = await fetch(`/api/stats?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setData(json);
    } catch { /* empty */ }
    setLoading(false);
  }, [dateStart, dateEnd, companyFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Chart data
  const companiesMap = data?.companies_map ?? {};
  const companyEntries = Object.entries(companiesMap);

  const barData = (data?.ca_par_mois ?? []).map((row) => {
    const month = (row.month as string) ?? "";
    const [, m] = month.split("-");
    const label = MONTHS_SHORT[parseInt(m) - 1] ?? month;
    const entry: Record<string, unknown> = { name: label };
    for (const [cid, cname] of companyEntries) {
      entry[cname] = (row[cid] as number) ?? 0;
    }
    return entry;
  });

  const pieData = (data?.repartition_paiement ?? []).map((r) => ({
    name: PAYMENT_LABELS[r.method] ?? r.method,
    value: r.amount,
    count: r.count,
    color: PAYMENT_COLORS[r.method] ?? "#9ca3af",
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Statistiques</h1>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Période</label>
            <select value={periodIdx} onChange={(e) => setPeriodIdx(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20">
              {PERIOD_OPTIONS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
            </select>
          </div>
          {periodIdx === 4 && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Début</label>
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fin</label>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Société</label>
            <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20">
              <option value="">Toutes</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard label="CA TTC" value={fmtEur(data.total_ca)} color="#6366f1" />
            <KpiCard label="Interventions" value={String(data.total_interventions)} color="#10b981" />
            <KpiCard label="Factures en attente" value={String(data.pending_count)} color="#f59e0b" />
            <KpiCard label="Montant en attente" value={fmtEur(data.pending_amount)} color="#ef4444" />
          </div>

          {/* ── CA par mois ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">CA par mois</h2>
            {barData.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">Aucune donnée sur la période</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => fmtEur(Number(value))} />
                  {companyEntries.map(([, cname]) => (
                    <Bar key={cname} dataKey={cname} stackId="ca" fill={COMPANY_COLORS[cname] ?? "#6366f1"} radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Répartition paiement ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Répartition par mode de paiement</h2>
            {pieData.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">Aucune donnée</p>
            ) : (
              <div className="flex flex-col md:flex-row items-center gap-6">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Legend />
                    <Tooltip formatter={(value) => fmtEur(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

        </>
      ) : null}

    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${color}15` }}>
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
