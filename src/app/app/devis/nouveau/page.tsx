"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { useAppContext } from "../../context";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ClientInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  nb_splits: number | null;
}

interface PricingItem {
  id: string;
  label: string;
  price_ht: number;
  unit: string;
}

interface QuoteLine {
  key: string;
  label: string;
  quantity: number;
  unit_price_ht: number;
}

/* ------------------------------------------------------------------ */
/*  Company config                                                     */
/* ------------------------------------------------------------------ */

const COMPANY_CONFIG: Record<string, { code: string; taxCredit: boolean }> = {
  "NetVapeur": { code: "NV", taxCredit: true },
  "Clim Eco Pro": { code: "CEP", taxCredit: false },
  "Clim50": { code: "C50", taxCredit: true },
};

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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

let lineCounter = 0;
function nextLineKey() {
  lineCounter += 1;
  return `line-${lineCounter}`;
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function NouveauDevisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientIdParam = searchParams.get("client_id");
  const companyIdParam = searchParams.get("company_id");
  const { companies } = useAppContext();

  const [selectedCompany, setSelectedCompany] = useState(companyIdParam ?? "");
  const [clientId, setClientId] = useState(clientIdParam ?? "");
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" } | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientInfo[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);

  // Selected company name
  const companyName = companies.find((c) => c.id === selectedCompany)?.name ?? "";
  const companyConfig = COMPANY_CONFIG[companyName];
  const hasTaxCredit = companyConfig?.taxCredit ?? false;

  // Fetch client info when clientId changes
  const fetchClient = useCallback(async () => {
    if (!clientId) {
      setClient(null);
      return;
    }
    const token = await getToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.client) {
        setClient({
          id: json.client.id,
          first_name: json.client.first_name,
          last_name: json.client.last_name,
          email: json.client.email ?? null,
          address: json.client.address,
          postal_code: json.client.postal_code,
          city: json.client.city,
          nb_splits: json.client.nb_splits,
        });
      }
    } catch {
      setClient(null);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  // Fetch pricing when company changes (specific + general tarifs)
  const fetchPricing = useCallback(async () => {
    if (!selectedCompany) {
      setPricing([]);
      return;
    }
    const token = await getToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/pricing?company_id=${selectedCompany}&include_general=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setPricing(json.pricing ?? []);
    } catch {
      setPricing([]);
    }
  }, [selectedCompany]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  // Search clients
  async function handleClientSearch(query: string) {
    setClientSearch(query);
    if (query.length < 2) {
      setClientResults([]);
      return;
    }

    setSearchingClients(true);
    const token = await getToken();
    if (!token) {
      setSearchingClients(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (selectedCompany) params.set("company_id", selectedCompany);
      const res = await fetch(`/api/clients?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const clients = (json.clients ?? []) as ClientInfo[];
      const q = query.toLowerCase();
      setClientResults(
        clients.filter((c) =>
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
        ).slice(0, 10)
      );
    } catch {
      setClientResults([]);
    }
    setSearchingClients(false);
  }

  // Totals
  const totalHt = lines.reduce((sum, l) => sum + l.quantity * l.unit_price_ht, 0);
  const tvaAmount = totalHt * 0.2;
  const totalTtc = totalHt + tvaAmount;
  const taxCreditAmount = hasTaxCredit ? totalTtc * 0.5 : 0;
  const resteACharge = totalTtc - taxCreditAmount;

  // Line operations
  function addPricingLine(item: PricingItem) {
    setLines((prev) => [
      ...prev,
      {
        key: nextLineKey(),
        label: item.label,
        quantity: 1,
        unit_price_ht: item.price_ht,
      },
    ]);
    setShowPricingModal(false);
  }

  function updateLine(key: string, field: "quantity" | "unit_price_ht" | "label", value: string | number) {
    setLines((prev) =>
      prev.map((l) =>
        l.key === key ? { ...l, [field]: value } : l
      )
    );
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  // Save
  async function handleSave(sendAfterSave: boolean) {
    setFormError("");

    if (!selectedCompany) {
      setFormError("Veuillez sélectionner une société");
      return;
    }
    if (!clientId) {
      setFormError("Veuillez sélectionner un client");
      return;
    }
    if (lines.length === 0) {
      setFormError("Ajoutez au moins une ligne au devis");
      return;
    }

    if (sendAfterSave) {
      setSending(true);
    } else {
      setSaving(true);
    }
    const token = await getToken();
    if (!token) {
      setFormError("Session expirée, reconnectez-vous");
      setSaving(false);
      setSending(false);
      return;
    }

    try {
      const payload = {
        company_id: selectedCompany,
        client_id: clientId,
        lines: lines.map((l) => ({
          label: l.label,
          quantity: l.quantity,
          unit_price_ht: l.unit_price_ht,
        })),
        tva_rate: 20,
        tax_credit_rate: hasTaxCredit ? 50 : 0,
        status: "draft",
      };

      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (res.ok && json.quote) {
        if (sendAfterSave) {
          try {
            const emailRes = await fetch(`/api/quotes/${json.quote.id}/send-email`, {
              method: "POST",
              headers: authHeaders(token),
            });
            const emailJson = await emailRes.json();
            if (emailRes.ok && emailJson.success) {
              setToast({ message: "Devis enregistré et envoyé par email", type: "success" });
            } else {
              setToast({ message: `Devis enregistré. L'email n'a pas pu être envoyé : ${emailJson.error ?? "erreur inconnue"}`, type: "warning" });
            }
          } catch {
            setToast({ message: "Devis enregistré. L'email n'a pas pu être envoyé.", type: "warning" });
          }
          setTimeout(() => router.push("/app/devis"), 1500);
        } else {
          router.push("/app/devis");
        }
      } else {
        console.error("[devis/nouveau] API error:", json);
        setFormError(json.error || "Erreur lors de la création du devis");
      }
    } catch (err) {
      console.error("[devis/nouveau] Save error:", err);
      setFormError("Erreur réseau, réessayez");
    }
    setSaving(false);
    setSending(false);
  }

  const inputCls =
    "w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1]/50 focus:ring-2 focus:ring-[#6366f1]/10 transition-all";

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

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nouveau devis</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company selector */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Société
            </h2>
            <select
              className={inputCls}
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
            >
              <option value="">Sélectionner une société</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Client selector */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Client
            </h2>
            {client ? (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {client.first_name} {client.last_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {[client.address, client.postal_code, client.city].filter(Boolean).join(", ") || "Pas d'adresse"}
                  </p>
                  {client.nb_splits && (
                    <p className="text-sm text-gray-500">{client.nb_splits} split(s)</p>
                  )}
                </div>
                <button
                  onClick={() => { setClientId(""); setClient(null); }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Changer
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  className={inputCls}
                  type="text"
                  placeholder="Rechercher un client par nom..."
                  value={clientSearch}
                  onChange={(e) => handleClientSearch(e.target.value)}
                />
                {searchingClients && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {clientResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-100 max-h-48 overflow-y-auto">
                    {clientResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setClientId(c.id);
                          setClientSearch("");
                          setClientResults([]);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-medium text-gray-900">
                          {c.first_name} {c.last_name}
                        </span>
                        {c.city && (
                          <span className="text-gray-400 ml-2">{c.city}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quote lines */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Lignes du devis
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPricingModal(true)}
                  disabled={!selectedCompany}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#6366f1] bg-[#6366f1]/5 hover:bg-[#6366f1]/10 rounded-lg transition-colors disabled:opacity-40"
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
            </div>

            {lines.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-lg">
                <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="text-gray-400 text-sm">Ajoutez des lignes au devis</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Header */}
                <div className="hidden sm:grid grid-cols-12 gap-3 px-3 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="col-span-5">Libellé</div>
                  <div className="col-span-2 text-center">Qté</div>
                  <div className="col-span-2 text-right">Prix unit. HT</div>
                  <div className="col-span-2 text-right">Total HT</div>
                  <div className="col-span-1" />
                </div>
                {lines.map((line) => (
                  <div
                    key={line.key}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3 rounded-lg bg-gray-50/80 border border-gray-100"
                  >
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
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, "quantity", parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm text-gray-900 text-right bg-white focus:outline-none focus:border-[#6366f1]/50"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price_ht}
                        onChange={(e) => updateLine(line.key, "unit_price_ht", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="sm:col-span-2 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(line.quantity * line.unit_price_ht)}
                    </div>
                    <div className="sm:col-span-1 text-right">
                      <button
                        onClick={() => removeLine(line.key)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column — Summary */}
        <div className="space-y-6">
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
                <span className="font-bold text-gray-900">{formatCurrency(totalTtc)}</span>
              </div>

              {hasTaxCredit && (
                <>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                    <span className="text-green-600">{"Crédit d'impôt (50%)"}</span>
                    <span className="font-medium text-green-600">-{formatCurrency(taxCreditAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Reste à charge</span>
                    <span className="font-bold text-[#6366f1]">{formatCurrency(resteACharge)}</span>
                  </div>
                </>
              )}
            </div>

            {formError && (
              <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="mt-6 space-y-2">
              <button
                onClick={() => handleSave(false)}
                disabled={saving || sending}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                {saving ? "Enregistrement..." : "Enregistrer brouillon"}
              </button>
              <div className="relative group">
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving || sending || !client?.email}
                  className="w-full px-4 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                >
                  {sending ? "Envoi en cours..." : "Enregistrer et envoyer"}
                </button>
                {client && !client.email && (
                  <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap">
                    Le prospect n&apos;a pas d&apos;adresse email
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 z-50 px-4 py-2.5 text-white text-sm rounded-lg shadow-lg ${toast.type === "success" ? "bg-gray-900" : "bg-orange-500"}`}>
          {toast.message}
        </div>
      )}

      {/* Modal — Pricing list */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPricingModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[70vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-semibold text-gray-900">Tarifs {companyName}</h2>
              <button onClick={() => setShowPricingModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {pricing.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Aucun tarif configuré pour cette société</p>
              ) : (
                <div className="space-y-2">
                  {pricing.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addPricingLine(item)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-[#6366f1]/30 hover:bg-[#6366f1]/5 transition-all text-left"
                    >
                      <span className="text-sm font-medium text-gray-900">{item.label}</span>
                      <span className="text-sm text-[#6366f1] font-medium">
                        {formatCurrency(item.price_ht)} / {item.unit}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal — Custom line */}
      {showCustomModal && (
        <CustomLineModal
          onClose={() => setShowCustomModal(false)}
          onAdd={(label, price) => {
            setLines((prev) => [
              ...prev,
              { key: nextLineKey(), label, quantity: 1, unit_price_ht: price },
            ]);
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

function CustomLineModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (label: string, price: number) => void;
}) {
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");

  const inputCls =
    "w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1]/50 focus:ring-2 focus:ring-[#6366f1]/10 transition-all";
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
            <input
              className={inputCls}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Mise en service"
            />
          </div>
          <div>
            <label className={labelCls}>Prix unitaire HT</label>
            <input
              className={inputCls}
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
              Annuler
            </button>
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
