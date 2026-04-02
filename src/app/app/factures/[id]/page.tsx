"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-client";

interface InvoiceLine {
  id: string;
  label: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  total_ht: number;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  payment_method: string | null;
  total_ht: number;
  tva_rate: number;
  total_tva: number;
  total_ttc: number;
  tax_credit_applicable: boolean;
  tax_credit_amount: number;
  payment_due_date: string | null;
  payment_date: string | null;
  late_fee_percentage: number;
  late_fee_applied: boolean;
  notes: string | null;
  created_at: string;
  intervention_id: string | null;
  quote_id: string | null;
  lines: InvoiceLine[];
  client: Client | null;
  company: Company | null;
}

async function getToken() {
  if (!supabaseBrowser) return null;
  const session = (await supabaseBrowser.auth.getSession()).data.session;
  return session?.access_token ?? null;
}

function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  paid: { label: "Payée", bg: "bg-green-100", text: "text-green-700" },
  pending: { label: "En attente", bg: "bg-orange-100", text: "text-orange-700" },
  overdue: { label: "En retard", bg: "bg-red-100", text: "text-red-700" },
  cancelled: { label: "Annulée", bg: "bg-gray-100", text: "text-gray-600" },
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Espèces", check: "Chèque", card: "CB", deferred: "Facture différée",
};

function fmtEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function fmtDateFr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function FactureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Mark as paid form
  const [showPayForm, setShowPayForm] = useState(false);
  const [payMethod, setPayMethod] = useState("card");
  const [payDate, setPayDate] = useState(() => {
    const n = new Date();
    const pad = (v: number) => String(v).padStart(2, "0");
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch(`/api/invoices/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { setError("Facture introuvable"); setLoading(false); return; }
        const json = await res.json();
        setInvoice(json.invoice);
      } catch { setError("Erreur de chargement"); }
      setLoading(false);
    })();
  }, [id]);

  async function handleMarkPaid() {
    setSaving(true);
    const token = await getToken();
    if (!token) { setSaving(false); return; }
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PUT", headers: authHeaders(token),
      body: JSON.stringify({ status: "paid", payment_method: payMethod, payment_date: payDate }),
    });
    if (res.ok) {
      const json = await res.json();
      setInvoice((prev) => prev ? { ...prev, ...json.invoice, lines: prev.lines, client: prev.client, company: prev.company } : prev);
      setShowPayForm(false);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-600 text-lg">{error || "Facture introuvable"}</p>
        <button onClick={() => router.back()} className="text-[#6366f1] font-medium">
          Retour aux factures
        </button>
      </div>
    );
  }

  const st = STATUS_MAP[invoice.status] ?? STATUS_MAP.pending;
  const client = invoice.client;
  const addr = client ? [client.address, client.postal_code, client.city].filter(Boolean).join(", ") : "";

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg hover:bg-gray-200 transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h1>
          <p className="text-sm text-gray-500">
            Créée le {fmtDateFr(invoice.created_at.slice(0, 10))}
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${st.bg} ${st.text}`}>
          {st.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending warning */}
          {invoice.status === "pending" && invoice.payment_due_date && (
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
              <p className="text-sm text-orange-800">
                Facture en attente de règlement. Échéance le <strong>{fmtDateFr(invoice.payment_due_date)}</strong>.
                {" "}En cas de non-paiement dans les délais, une majoration de {invoice.late_fee_percentage}% sera appliquée.
              </p>
              {!showPayForm ? (
                <button onClick={() => setShowPayForm(true)}
                  className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                  Marquer comme payée
                </button>
              ) : (
                <div className="mt-3 p-3 bg-white rounded-lg border border-orange-200 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Mode de paiement</label>
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900">
                      <option value="cash">Espèces</option>
                      <option value="check">Chèque</option>
                      <option value="card">CB</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date de paiement</label>
                    <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleMarkPaid} disabled={saving}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                      {saving ? "..." : "Confirmer le paiement"}
                    </button>
                    <button onClick={() => setShowPayForm(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg">
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lines */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Libellé</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 w-20">Qté</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Prix unit.</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 w-28">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line) => (
                  <tr key={line.id} className="border-b border-gray-50">
                    <td className="px-4 py-3 text-gray-900">{line.label}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{line.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtEur(line.unit_price)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtEur(line.total_ht)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-gray-200 px-4 py-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total HT</span>
                <span className="font-medium text-gray-700">{fmtEur(invoice.total_ht)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">TVA {invoice.tva_rate}%</span>
                <span className="font-medium text-gray-700">{fmtEur(invoice.total_tva)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-1 border-t border-gray-100">
                <span className="text-gray-900">Total TTC</span>
                <span className="text-indigo-600">{fmtEur(invoice.total_ttc)}</span>
              </div>
              {invoice.tax_credit_applicable && invoice.tax_credit_amount > 0 && (
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-green-600">{"Crédit d'impôt"}</span>
                  <span className="text-green-600">-{fmtEur(invoice.tax_credit_amount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* PDF download */}
          <button
            onClick={async () => {
              const token = await getToken();
              if (!token) return;
              const res = await fetch(`/api/invoices/${id}/pdf`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) return;
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `${invoice.invoice_number}.pdf`; a.click();
              URL.revokeObjectURL(url);
            }}
            className="w-full py-3 bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-medium rounded-xl transition-colors inline-flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Télécharger le PDF
          </button>
        </div>

        {/* Right column — info sidebar */}
        <div className="space-y-6">
          {/* Client */}
          {client && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Client</h3>
              <p className="text-sm font-medium text-gray-900">{client.first_name} {client.last_name}</p>
              {addr && <p className="text-sm text-gray-600 mt-1">{addr}</p>}
              {client.phone && (
                <a href={`tel:${client.phone}`} className="text-sm text-[#6366f1] block mt-1">{client.phone}</a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} className="text-sm text-[#6366f1] block mt-1">{client.email}</a>
              )}
            </div>
          )}

          {/* Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Détails</h3>
            {invoice.company && (
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Société</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                  {invoice.company.name}
                </span>
              </div>
            )}
            {invoice.payment_method && (
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Paiement</span>
                <span className="text-sm font-medium text-gray-900">{PAYMENT_LABELS[invoice.payment_method] ?? invoice.payment_method}</span>
              </div>
            )}
            {invoice.status === "paid" && invoice.payment_date && (
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Payée le</span>
                <span className="text-sm font-medium text-gray-900">{fmtDateFr(invoice.payment_date)}</span>
              </div>
            )}
            {invoice.payment_due_date && (
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Échéance</span>
                <span className="text-sm font-medium text-gray-900">{fmtDateFr(invoice.payment_due_date)}</span>
              </div>
            )}
          </div>

          {/* Links */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Documents liés</h3>
            {invoice.intervention_id && (
              <Link href={`/app/interventions/${invoice.intervention_id}`}
                className="flex items-center gap-2 text-sm text-[#6366f1] font-medium hover:underline">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63" />
                </svg>
                Voir l{"'"}intervention
              </Link>
            )}
            {invoice.quote_id && (
              <Link href={`/app/devis/${invoice.quote_id}`}
                className="flex items-center gap-2 text-sm text-[#6366f1] font-medium hover:underline">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Voir le devis
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
