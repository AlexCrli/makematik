"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { useAppContext } from "../context";

interface InvoiceItem {
  id: string;
  invoice_number: string;
  client_name: string | null;
  company_name: string | null;
  company_id: string;
  total_ttc: number;
  status: string;
  payment_method: string | null;
  created_at: string;
}

interface DeferredInvoice {
  id: string;
  invoice_number: string;
  client_name: string | null;
  company_name: string | null;
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

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  paid: { label: "Payée", color: "bg-green-100 text-green-700" },
  pending: { label: "En attente", color: "bg-orange-100 text-orange-700" },
  overdue: { label: "En retard", color: "bg-red-100 text-red-700" },
  cancelled: { label: "Annulée", color: "bg-gray-100 text-gray-600" },
};

const STATUS_FILTERS = [
  { value: "", label: "Toutes" },
  { value: "paid", label: "Payées" },
  { value: "pending", label: "En attente" },
  { value: "overdue", label: "En retard" },
];

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Espèces", check: "Chèque", card: "CB", deferred: "Différé",
};

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function todayStr(): string {
  const n = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

function daysDiff(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDateFr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

async function getToken() {
  if (!supabaseBrowser) return null;
  return (await supabaseBrowser.auth.getSession()).data.session?.access_token ?? null;
}

function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function FacturesPage() {
  const { companies } = useAppContext();
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");

  // Deferred invoices
  const [deferred, setDeferred] = useState<DeferredInvoice[]>([]);
  const [deferredPaid, setDeferredPaid] = useState<PaidDeferredInvoice[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Pay modal
  const [payingInvoice, setPayingInvoice] = useState<DeferredInvoice | null>(null);
  const [payMethod, setPayMethod] = useState("card");
  const [payDate, setPayDate] = useState(todayStr());
  const [applyLateFee, setApplyLateFee] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchInvoices = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (companyFilter) params.set("company_id", companyFilter);

    try {
      const res = await fetch(`/api/invoices?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setInvoices(json.invoices ?? []);
    } catch {
      setInvoices([]);
    }
    setLoading(false);
  }, [statusFilter, companyFilter]);

  const fetchDeferred = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setDeferred(json.factures_differees ?? []);
      setDeferredPaid(json.factures_differees_reglees ?? []);
    } catch { /* empty */ }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { fetchDeferred(); }, [fetchDeferred]);

  async function handleMarkPaid() {
    if (!payingInvoice) return;
    setSaving(true);
    const token = await getToken();
    if (!token) { setSaving(false); return; }

    await fetch(`/api/invoices/${payingInvoice.id}`, {
      method: "PUT", headers: authHeaders(token),
      body: JSON.stringify({
        status: "paid",
        payment_method: payMethod,
        payment_date: payDate,
        ...(applyLateFee ? { late_fee_applied: true } : {}),
      }),
    });
    setPayingInvoice(null);
    setSaving(false);
    fetchInvoices();
    fetchDeferred();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Factures</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Statut</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20">
              {STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
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

      {/* Invoice list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-20 text-gray-500">Aucune facture</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Numéro</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Société</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Montant TTC</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const st = STATUS_MAP[inv.status] ?? STATUS_MAP.pending;
                  return (
                    <tr key={inv.id} onClick={() => router.push(`/app/factures/${inv.id}`)}
                      className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-700">{inv.client_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        {inv.company_name && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">{inv.company_name}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtEur(inv.total_ttc)}</td>
                      <td className="px-4 py-3"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span></td>
                      <td className="px-4 py-3 text-gray-500">{new Date(inv.created_at).toLocaleDateString("fr-FR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Paiements différés ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Paiements différés
          <span className="ml-2 text-gray-400">({deferred.length})</span>
        </h2>

        {deferred.length === 0 ? (
          <p className="text-gray-400 text-sm py-6 text-center">Aucun paiement différé en attente</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Facture</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Client</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Société</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">Montant</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Échéance</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Statut</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {deferred.map((inv) => {
                  const days = inv.payment_due_date ? daysDiff(inv.payment_due_date) : 0;
                  return (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer"
                      onClick={() => router.push(`/app/factures/${inv.id}`)}>
                      <td className="px-3 py-3 font-medium text-gray-900">{inv.invoice_number}</td>
                      <td className="px-3 py-3 text-gray-700">{inv.client_name ?? "—"}</td>
                      <td className="px-3 py-3">
                        {inv.company_name && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">{inv.company_name}</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900">{fmtEur(inv.total_ttc)}</td>
                      <td className="px-3 py-3 text-gray-600">{inv.payment_due_date ? fmtDateFr(inv.payment_due_date) : "—"}</td>
                      <td className="px-3 py-3">
                        {days > 0 && <span className="text-green-600 text-xs font-medium">{days}j restants</span>}
                        {days === 0 && <span className="text-orange-600 text-xs font-medium">{"Aujourd'hui"}</span>}
                        {days < 0 && <span className="text-red-600 text-xs font-bold">{Math.abs(days)}j de retard</span>}
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={(e) => {
                          e.stopPropagation();
                          setPayingInvoice(inv);
                          setApplyLateFee(days < 0);
                          setPayDate(todayStr());
                        }} className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100">
                          Marquer payée
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Historique différés réglés ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <button onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-gray-500 uppercase tracking-wide hover:bg-gray-50">
          <span>
            Historique des paiements différés réglés
            <span className="ml-2 text-gray-400">({deferredPaid.length})</span>
          </span>
          <svg className={`w-4 h-4 transition-transform ${showHistory ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {showHistory && (
          <div className="px-6 pb-4">
            {deferredPaid.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">Aucun historique</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Facture</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Client</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">Montant</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Mode</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Payée le</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Majoration</th>
                  </tr>
                </thead>
                <tbody>
                  {deferredPaid.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{inv.invoice_number}</td>
                      <td className="px-3 py-2 text-gray-700">{inv.client_name ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">{fmtEur(inv.total_ttc)}</td>
                      <td className="px-3 py-2 text-gray-600">{PAYMENT_LABELS[inv.payment_method ?? ""] ?? inv.payment_method}</td>
                      <td className="px-3 py-2 text-gray-600">{inv.payment_date ? fmtDateFr(inv.payment_date) : "—"}</td>
                      <td className="px-3 py-2">{inv.late_fee_applied ? <span className="text-red-600 text-xs font-medium">Oui</span> : <span className="text-gray-400 text-xs">Non</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Pay modal ── */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPayingInvoice(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Marquer comme payée</h3>
            <p className="text-sm text-gray-600 mb-4">{payingInvoice.invoice_number} — {payingInvoice.client_name}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900">
                  <option value="cash">Espèces</option>
                  <option value="check">Chèque</option>
                  <option value="card">CB</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de paiement</label>
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900" />
              </div>
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={applyLateFee} onChange={(e) => setApplyLateFee(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Appliquer majoration retard ({payingInvoice.late_fee_percentage}%)</p>
                  {applyLateFee && (
                    <p className="text-xs text-red-600 mt-1">
                      Montant initial : {fmtEur(payingInvoice.total_ttc)} → Avec majoration : {fmtEur(payingInvoice.total_ttc * (1 + payingInvoice.late_fee_percentage / 100))}
                    </p>
                  )}
                </div>
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleMarkPaid} disabled={saving}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                {saving ? "..." : "Confirmer le paiement"}
              </button>
              <button onClick={() => setPayingInvoice(null)}
                className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
