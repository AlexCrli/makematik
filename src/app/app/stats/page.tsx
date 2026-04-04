"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-client";
import { useAppContext } from "../context";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
  LineChart, Line,
} from "recharts";

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

interface CompanyStats {
  company_id: string;
  company_name: string;
  ca_ttc: number;
  interventions: number;
  factures: number;
  ticket_moyen: number;
}

interface StatsData {
  total_ca: number;
  total_interventions: number;
  pending_count: number;
  pending_amount: number;
  ca_par_mois: Record<string, unknown>[];
  interventions_par_mois?: { month: string; count: number }[];
  ca_par_societe?: CompanyStats[];
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

function fmtEurShort(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
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

/** Build an array of the last 12 months as "YYYY-MM" strings */
function getLast12Months(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const pad = (v: number) => String(v).padStart(2, "0");
    months.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }
  return months;
}

/** Smart Y-axis formatter based on data magnitude */
function yAxisFormatter(maxVal: number) {
  return (v: number) => {
    if (maxVal >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (maxVal >= 1000) return `${(v / 1000).toFixed(v >= 1000 ? 0 : 1)}k`;
    return `${v} \u20AC`;
  };
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

  // Chart data — fill last 12 months
  const companiesMap = data?.companies_map ?? {};
  const companyEntries = Object.entries(companiesMap);
  const last12 = getLast12Months();

  // Index raw CA data by month
  const caByMonth: Record<string, Record<string, unknown>> = {};
  for (const row of data?.ca_par_mois ?? []) {
    const month = (row.month as string) ?? "";
    caByMonth[month] = row;
  }

  const barData = last12.map((month) => {
    const [, m] = month.split("-");
    const label = MONTHS_SHORT[parseInt(m) - 1] ?? month;
    const row = caByMonth[month];
    const entry: Record<string, unknown> = { name: label, _month: month };
    let total = 0;
    for (const [cid, cname] of companyEntries) {
      const val = row ? (row[cid] as number) ?? 0 : 0;
      entry[cname] = val;
      total += val;
    }
    entry._total = total;
    return entry;
  });

  // Find max value for Y-axis formatter
  const barMax = Math.max(...barData.map((d) => d._total as number), 0);

  // Interventions par mois — fill last 12 months
  const ivByMonth: Record<string, number> = {};
  for (const row of data?.interventions_par_mois ?? []) {
    ivByMonth[row.month] = row.count;
  }

  const lineData = last12.map((month) => {
    const [, m] = month.split("-");
    return { name: MONTHS_SHORT[parseInt(m) - 1] ?? month, count: ivByMonth[month] ?? 0 };
  });

  const pieData = (data?.repartition_paiement ?? []).map((r) => ({
    name: PAYMENT_LABELS[r.method] ?? r.method,
    value: r.amount,
    count: r.count,
    color: PAYMENT_COLORS[r.method] ?? "#9ca3af",
  }));

  // Company table
  const companyStats = data?.ca_par_societe ?? [];
  const totals = companyStats.reduce(
    (acc, c) => ({ ca: acc.ca + c.ca_ttc, iv: acc.iv + c.interventions, fac: acc.fac + c.factures }),
    { ca: 0, iv: 0, fac: 0 },
  );

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
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">CA par mois</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter(barMax)} />
                <Tooltip formatter={(value) => fmtEur(Number(value))} />
                {companyEntries.map(([, cname], idx) => (
                  <Bar key={cname} dataKey={cname} stackId="ca" fill={COMPANY_COLORS[cname] ?? "#6366f1"} radius={[2, 2, 0, 0]} maxBarSize={80}>
                    {/* Label on topmost bar only */}
                    {idx === companyEntries.length - 1 && (
                      <LabelList
                        dataKey="_total"
                        position="top"
                        formatter={(v) => { const n = Number(v ?? 0); return n > 0 ? fmtEurShort(n) : ""; }}
                        style={{ fontSize: 10, fill: "#6b7280" }}
                      />
                    )}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Interventions par mois ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Interventions par mois</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="Interventions" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: "#3b82f6" }}>
                  <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: "#3b82f6" }} formatter={(v) => { const n = Number(v ?? 0); return n > 0 ? String(n) : ""; }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── Répartition paiement ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 mb-6">
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

          {/* ── Tableau récapitulatif par société ── */}
          {companyStats.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Récapitulatif par société</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Société</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">CA TTC</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Interventions</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Factures</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Ticket moyen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {companyStats.map((c) => (
                      <tr key={c.company_id} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 font-medium text-gray-900">{c.company_name}</td>
                        <td className="py-2.5 px-3 text-right text-gray-700">{fmtEur(c.ca_ttc)}</td>
                        <td className="py-2.5 px-3 text-right text-gray-700">{c.interventions}</td>
                        <td className="py-2.5 px-3 text-right text-gray-700">{c.factures}</td>
                        <td className="py-2.5 px-3 text-right text-gray-700">{fmtEur(c.ticket_moyen)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-200 font-bold">
                      <td className="py-2.5 px-3 text-gray-900">Total</td>
                      <td className="py-2.5 px-3 text-right text-gray-900">{fmtEur(totals.ca)}</td>
                      <td className="py-2.5 px-3 text-right text-gray-900">{totals.iv}</td>
                      <td className="py-2.5 px-3 text-right text-gray-900">{totals.fac}</td>
                      <td className="py-2.5 px-3 text-right text-gray-900">{totals.fac > 0 ? fmtEur(totals.ca / totals.fac) : "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
