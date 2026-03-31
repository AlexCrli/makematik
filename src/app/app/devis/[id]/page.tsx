"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface QuoteLine {
  id: string;
  label: string;
  quantity: number;
  unit_price_ht: number;
  total_ht: number;
}

interface EditableLine {
  key: string;
  label: string;
  quantity: number;
  unit_price_ht: number;
}

interface PricingItem {
  id: string;
  label: string;
  price_ht: number;
  unit: string;
}

interface QuoteDetail {
  id: string;
  quote_number: string;
  company_id: string;
  client_id: string;
  total_ht: number;
  tva_rate: number;
  total_ttc: number;
  tax_credit_amount: number;
  status: string;
  created_at: string;
  sent_at: string | null;
  lines: QuoteLine[];
  client: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    postal_code: string | null;
    city: string | null;
    nb_splits: number | null;
  } | null;
  company: {
    id: string;
    name: string;
  } | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COMPANY_TAX_CREDIT: Record<string, boolean> = {
  "NetVapeur": true,
  "Clim Eco Pro": false,
  "AC Clean": false,
  "Clim50": true,
};

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700" },
    sent: { label: "Envoyé", color: "bg-blue-100 text-blue-700" },
    accepted: { label: "Accepté", color: "bg-green-100 text-green-700" },
    refused: { label: "Refusé", color: "bg-red-100 text-red-700" },
    expired: { label: "Expiré", color: "bg-orange-100 text-orange-700" },
  };
  const s = map[status] ?? { label: status, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function getToken() {
  if (!supabaseBrowser) return null;
  const session = (await supabaseBrowser.auth.getSession()).data.session;
  return session?.access_token ?? null;
}

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

let lineCounter = 0;
function nextLineKey() {
  lineCounter += 1;
  return `ek-${lineCounter}`;
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function DevisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Draft edit state
  const [editLines, setEditLines] = useState<EditableLine[]>([]);
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);

  const fetchQuote = useCallback(async () => {
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    try {
      const res = await fetch(`/api/quotes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.quote) {
        setQuote(json.quote);
        // Initialize editable lines from quote lines
        if (json.quote.status === "draft") {
          setEditLines(
            json.quote.lines.map((l: QuoteLine) => ({
              key: nextLineKey(),
              label: l.label,
              quantity: l.quantity,
              unit_price_ht: l.unit_price_ht,
            }))
          );
        }
      }
    } catch (err) {
      console.error("[devis detail] Fetch error:", err);
    }
    setLoading(false);
  }, [id]);

  // Fetch pricing for the company (draft mode)
  const fetchPricing = useCallback(async () => {
    if (!quote || quote.status !== "draft") return;
    const token = await getToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/pricing?company_id=${quote.company_id}&include_general=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setPricing(json.pricing ?? []);
    } catch {
      setPricing([]);
    }
  }, [quote]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const isDraft = quote?.status === "draft";
  const hasTaxCredit = quote?.company ? (COMPANY_TAX_CREDIT[quote.company.name] ?? false) : false;
  const taxCreditRate = hasTaxCredit ? 50 : 0;

  // Computed totals for draft edit mode
  const editTotalHt = editLines.reduce((sum, l) => sum + l.quantity * l.unit_price_ht, 0);
  const editTvaAmount = editTotalHt * 0.2;
  const editTotalTtc = editTotalHt + editTvaAmount;
  const editTaxCredit = editTotalTtc * (taxCreditRate / 100);
  const editResteACharge = editTotalTtc - editTaxCredit;

  // Read-only totals
  const readTvaAmount = quote ? quote.total_ht * (quote.tva_rate / 100) : 0;
  const readResteACharge = quote ? quote.total_ttc - quote.tax_credit_amount : 0;

  // Draft line operations
  function updateLine(key: string, field: "quantity" | "unit_price_ht" | "label", value: string | number) {
    setEditLines((prev) => prev.map((l) => l.key === key ? { ...l, [field]: value } : l));
  }
  function removeLine(key: string) {
    setEditLines((prev) => prev.filter((l) => l.key !== key));
  }
  function addPricingLine(item: PricingItem) {
    setEditLines((prev) => [...prev, { key: nextLineKey(), label: item.label, quantity: 1, unit_price_ht: item.price_ht }]);
    setShowPricingModal(false);
  }

  // Save draft
  async function handleSave() {
    if (!quote || editLines.length === 0) return;
    setActionLoading(true);
    const token = await getToken();
    if (!token) { setActionLoading(false); return; }

    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
          lines: editLines.map((l) => ({ label: l.label, quantity: l.quantity, unit_price_ht: l.unit_price_ht })),
          tva_rate: 20,
          tax_credit_rate: taxCreditRate,
        }),
      });
      if (res.ok) fetchQuote();
    } catch (err) {
      console.error("[devis detail] Save error:", err);
    }
    setActionLoading(false);
  }

  // Send quote
  async function handleSend() {
    if (!quote || editLines.length === 0) return;
    setActionLoading(true);
    const token = await getToken();
    if (!token) { setActionLoading(false); return; }

    try {
      // First save lines
      await fetch(`/api/quotes/${id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
          lines: editLines.map((l) => ({ label: l.label, quantity: l.quantity, unit_price_ht: l.unit_price_ht })),
          tva_rate: 20,
          tax_credit_rate: taxCreditRate,
        }),
      });
      // Then send
      const res = await fetch(`/api/quotes/${id}/send`, {
        method: "POST",
        headers: authHeaders(token),
      });
      if (res.ok) fetchQuote();
    } catch (err) {
      console.error("[devis detail] Send error:", err);
    }
    setActionLoading(false);
  }

  // Mark refused (non-draft)
  async function handleRefuse() {
    if (!quote) return;
    setActionLoading(true);
    const token = await getToken();
    if (!token) { setActionLoading(false); return; }

    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ status: "refused" }),
      });

      if (res.ok && quote.client_id) {
        await fetch(`/api/clients/${quote.client_id}`, {
          method: "PUT",
          headers: authHeaders(token),
          body: JSON.stringify({ status: "lost" }),
        });
      }
      if (res.ok) fetchQuote();
    } catch (err) {
      console.error("[devis detail] Refuse error:", err);
    }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-32">
        <p className="text-gray-400 text-sm">Devis introuvable</p>
        <button
          onClick={() => router.push("/app/devis")}
          className="mt-4 text-sm text-[#6366f1] hover:text-[#818cf8] font-medium"
        >
          Retour aux devis
        </button>
      </div>
    );
  }

  // Choose totals based on mode
  const totalHt = isDraft ? editTotalHt : quote.total_ht;
  const tvaAmount = isDraft ? editTvaAmount : readTvaAmount;
  const totalTtc = isDraft ? editTotalTtc : quote.total_ttc;
  const taxCreditAmount = isDraft ? editTaxCredit : quote.tax_credit_amount;
  const resteACharge = isDraft ? editResteACharge : readResteACharge;

  return (
    <div>
      {/* Back link */}
      <button
        onClick={() => router.push("/app/devis")}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Retour aux devis
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{quote.quote_number}</h1>
              {statusBadge(quote.status)}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-500">
              {quote.company && <span>{quote.company.name}</span>}
              <span>Créé le {new Date(quote.created_at).toLocaleDateString("fr-FR")}</span>
              {quote.sent_at && (
                <span>Envoyé le {new Date(quote.sent_at).toLocaleDateString("fr-FR")}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isDraft ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={actionLoading || editLines.length === 0}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  {actionLoading ? "..." : "Enregistrer"}
                </button>
                <button
                  onClick={handleSend}
                  disabled={actionLoading || editLines.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#6366f1] hover:bg-[#818cf8] rounded-lg transition-colors disabled:opacity-40"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  Envoyer le devis
                </button>
              </>
            ) : (
              <>
                {quote.status === "sent" && (
                  <>
                    <button
                      onClick={() => router.push(`/app/devis/${id}/rdv`)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                      Prendre RDV
                    </button>
                    <button
                      onClick={handleRefuse}
                      disabled={actionLoading}
                      className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-40"
                    >
                      Marquer refusé
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Lines */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client info */}
          {quote.client && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Client</h2>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {quote.client.first_name} {quote.client.last_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {[quote.client.address, quote.client.postal_code, quote.client.city].filter(Boolean).join(", ")}
                  </p>
                  {quote.client.phone && <p className="text-sm text-gray-500">{quote.client.phone}</p>}
                  {quote.client.email && <p className="text-sm text-gray-500">{quote.client.email}</p>}
                </div>
                <button
                  onClick={() => router.push(`/app/prospects/${quote.client_id}`)}
                  className="text-xs font-medium text-[#6366f1] hover:text-[#818cf8] transition-colors"
                >
                  Voir la fiche
                </button>
              </div>
            </div>
          )}

          {/* Quote lines */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Lignes du devis
              </h2>
              {isDraft && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPricingModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#6366f1] bg-[#6366f1]/5 hover:bg-[#6366f1]/10 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Depuis les tarifs
                  </button>
                  <button
                    onClick={() => setShowCustomModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Ligne personnalisée
                  </button>
                </div>
              )}
            </div>

            {isDraft ? (
              /* ---- DRAFT: Editable lines ---- */
              editLines.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-lg">
                  <p className="text-gray-400 text-sm">Ajoutez des lignes au devis</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="hidden sm:grid grid-cols-12 gap-3 px-3 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-5">Libellé</div>
                    <div className="col-span-2 text-center">Qté</div>
                    <div className="col-span-2 text-right">Prix unit. HT</div>
                    <div className="col-span-2 text-right">Total HT</div>
                    <div className="col-span-1" />
                  </div>
                  {editLines.map((line) => (
                    <div key={line.key} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3 rounded-lg bg-gray-50/80 border border-gray-100">
                      <div className="sm:col-span-5">
                        <input
                          className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:border-[#6366f1]/50"
                          value={line.label}
                          onChange={(e) => updateLine(line.key, "label", e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm text-gray-900 text-center bg-white focus:outline-none focus:border-[#6366f1]/50"
                          type="number" min="1" value={line.quantity}
                          onChange={(e) => updateLine(line.key, "quantity", parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm text-gray-900 text-right bg-white focus:outline-none focus:border-[#6366f1]/50"
                          type="number" min="0" step="0.01" value={line.unit_price_ht}
                          onChange={(e) => updateLine(line.key, "unit_price_ht", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="sm:col-span-2 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(line.quantity * line.unit_price_ht)}
                      </div>
                      <div className="sm:col-span-1 text-right">
                        <button onClick={() => removeLine(line.key)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* ---- NON-DRAFT: Read-only table ---- */
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3">Libellé</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3">Qté</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3">Prix unit. HT</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3">Total HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {quote.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="py-3 text-sm text-gray-900">{line.label}</td>
                        <td className="py-3 text-sm text-gray-600 text-center">{line.quantity}</td>
                        <td className="py-3 text-sm text-gray-600 text-right">{formatCurrency(line.unit_price_ht)}</td>
                        <td className="py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(line.total_ht)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right — Summary */}
        <div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Récapitulatif
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total HT</span>
                <span className="font-medium text-gray-900">{formatCurrency(totalHt)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">TVA (20%)</span>
                <span className="font-medium text-gray-900">{formatCurrency(tvaAmount)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                <span className="font-medium text-gray-700">Total TTC</span>
                <span className="font-bold text-gray-900 text-lg">{formatCurrency(totalTtc)}</span>
              </div>

              {hasTaxCredit && taxCreditAmount > 0 && (
                <>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                    <span className="text-green-600">{"Crédit d'impôt (50%)"}</span>
                    <span className="font-medium text-green-600">-{formatCurrency(taxCreditAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Reste à charge</span>
                    <span className="font-bold text-[#6366f1] text-lg">{formatCurrency(resteACharge)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal — Pricing list (draft only) */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPricingModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[70vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-semibold text-gray-900">Tarifs {quote.company?.name}</h2>
              <button onClick={() => setShowPricingModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {pricing.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Aucun tarif configuré</p>
              ) : (
                <div className="space-y-2">
                  {pricing.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addPricingLine(item)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-[#6366f1]/30 hover:bg-[#6366f1]/5 transition-all text-left"
                    >
                      <span className="text-sm font-medium text-gray-900">{item.label}</span>
                      <span className="text-sm text-[#6366f1] font-medium">{formatCurrency(item.price_ht)} / {item.unit}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal — Custom line (draft only) */}
      {showCustomModal && (
        <CustomLineModal
          onClose={() => setShowCustomModal(false)}
          onAdd={(label, price) => {
            setEditLines((prev) => [...prev, { key: nextLineKey(), label, quantity: 1, unit_price_ht: price }]);
            setShowCustomModal(false);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom line modal                                                  */
/* ------------------------------------------------------------------ */

function CustomLineModal({ onClose, onAdd }: { onClose: () => void; onAdd: (label: string, price: number) => void }) {
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");

  const inputCls = "w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1]/50 focus:ring-2 focus:ring-[#6366f1]/10 transition-all";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Ligne personnalisée</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Libellé</label>
            <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Mise en service" />
          </div>
          <div>
            <label className={labelCls}>Prix unitaire HT</label>
            <input className={inputCls} type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">Annuler</button>
            <button
              onClick={() => onAdd(label, parseFloat(price) || 0)}
              disabled={!label || !price}
              className="px-5 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Ajouter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
