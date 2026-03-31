"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-client";
import { useAppContext } from "../context";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PricingItem {
  id: string;
  label: string;
  price_ht: number;
  unit: string;
  is_active: boolean;
  company_id: string | null;
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

const UNIT_LABELS: Record<string, string> = {
  split: "par split",
  groupe: "par groupe",
  forfait: "forfait",
  heure: "par heure",
};

function unitLabel(unit: string) {
  return UNIT_LABELS[unit] ?? unit;
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function TarifsPage() {
  const { companies } = useAppContext();

  const [items, setItems] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCompany, setFilterCompany] = useState("all");
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PricingItem>>({});

  const fetchPricing = useCallback(async () => {
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("all", "true"); // include inactive
      if (filterCompany !== "all") {
        params.set("company_id", filterCompany);
      }
      const res = await fetch(`/api/pricing?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setItems(json.pricing ?? []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [filterCompany]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  function companyName(companyId: string | null) {
    if (!companyId) return "Toutes";
    return companies.find((c) => c.id === companyId)?.name ?? "—";
  }

  function startEdit(item: PricingItem) {
    setEditingId(item.id);
    setEditValues({ label: item.label, price_ht: item.price_ht, unit: item.unit, company_id: item.company_id });
  }

  async function saveEdit() {
    if (!editingId) return;
    const token = await getToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/pricing/${editingId}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify(editValues),
      });
      if (res.ok) {
        setEditingId(null);
        fetchPricing();
      }
    } catch (err) {
      console.error("[tarifs] Save error:", err);
    }
  }

  async function toggleActive(item: PricingItem) {
    const token = await getToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/pricing/${item.id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      if (res.ok) fetchPricing();
    } catch (err) {
      console.error("[tarifs] Toggle error:", err);
    }
  }

  const inputCls =
    "w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1]/50 focus:ring-2 focus:ring-[#6366f1]/10 transition-all";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Grille tarifaire{" "}
            <span className="text-base font-normal text-gray-400">
              ({items.length})
            </span>
          </h1>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouveau tarif
        </button>
      </div>

      {/* Filter by company */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-1 px-4 pt-3 pb-0 overflow-x-auto">
          <button
            onClick={() => setFilterCompany("all")}
            className={`shrink-0 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              filterCompany === "all"
                ? "border-[#6366f1] text-[#6366f1]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Tous
          </button>
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterCompany(c.id)}
              className={`shrink-0 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                filterCompany === c.id
                  ? "border-[#6366f1] text-[#6366f1]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
            <p className="text-gray-400 text-sm">Aucun tarif pour le moment</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Libellé</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Prix HT</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Unité</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Société</th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Actif</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => (
                    <tr key={item.id} className={`transition-colors ${!item.is_active ? "opacity-50" : "hover:bg-gray-50/50"}`}>
                      {editingId === item.id ? (
                        <>
                          <td className="px-6 py-2.5">
                            <input
                              className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:border-[#6366f1]/50"
                              value={editValues.label ?? ""}
                              onChange={(e) => setEditValues({ ...editValues, label: e.target.value })}
                            />
                          </td>
                          <td className="px-6 py-2.5">
                            <input
                              className="w-24 px-2 py-1.5 rounded border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:border-[#6366f1]/50"
                              type="number"
                              min="0"
                              step="0.01"
                              value={editValues.price_ht ?? 0}
                              onChange={(e) => setEditValues({ ...editValues, price_ht: parseFloat(e.target.value) || 0 })}
                            />
                          </td>
                          <td className="px-6 py-2.5">
                            <select
                              className="w-28 px-2 py-1.5 rounded border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:border-[#6366f1]/50"
                              value={editValues.unit ?? "split"}
                              onChange={(e) => setEditValues({ ...editValues, unit: e.target.value })}
                            >
                              {UNIT_OPTIONS.map((u) => (
                                <option key={u.value} value={u.value}>{u.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-2.5">
                            <select
                              className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:border-[#6366f1]/50"
                              value={editValues.company_id ?? ""}
                              onChange={(e) => setEditValues({ ...editValues, company_id: e.target.value || null })}
                            >
                              <option value="">Toutes</option>
                              {companies.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </td>
                          <td />
                          <td className="px-6 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={saveEdit}
                                className="text-xs font-medium text-green-600 hover:text-green-700"
                              >
                                Valider
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-xs font-medium text-gray-400 hover:text-gray-600"
                              >
                                Annuler
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-3.5 text-sm font-medium text-gray-900">{item.label}</td>
                          <td className="px-6 py-3.5 text-sm text-gray-900">{formatCurrency(item.price_ht)}</td>
                          <td className="px-6 py-3.5 text-sm text-gray-600">{unitLabel(item.unit)}</td>
                          <td className="px-6 py-3.5 text-sm text-gray-600">{companyName(item.company_id)}</td>
                          <td className="px-6 py-3.5 text-center">
                            <button
                              onClick={() => toggleActive(item)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                item.is_active ? "bg-[#6366f1]" : "bg-gray-200"
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                                  item.is_active ? "translate-x-[18px]" : "translate-x-[3px]"
                                }`}
                              />
                            </button>
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <button
                              onClick={() => startEdit(item)}
                              className="text-xs font-medium text-[#6366f1] hover:text-[#818cf8] transition-colors"
                            >
                              Modifier
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-50">
              {items.map((item) => (
                <div key={item.id} className={`p-4 space-y-2 ${!item.is_active ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm">{item.label}</span>
                    <button
                      onClick={() => toggleActive(item)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        item.is_active ? "bg-[#6366f1]" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                          item.is_active ? "translate-x-[18px]" : "translate-x-[3px]"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="font-medium text-gray-900">{formatCurrency(item.price_ht)}</span>
                    <span>/ {unitLabel(item.unit)}</span>
                    <span>{companyName(item.company_id)}</span>
                  </div>
                  <button
                    onClick={() => startEdit(item)}
                    className="text-xs font-medium text-[#6366f1]"
                  >
                    Modifier
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* New pricing modal */}
      {showNewModal && (
        <NewPricingModal
          companies={companies}
          onClose={() => setShowNewModal(false)}
          onCreated={() => { setShowNewModal(false); fetchPricing(); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  New Pricing Modal                                                  */
/* ------------------------------------------------------------------ */

const UNIT_OPTIONS = [
  { value: "split", label: "par split" },
  { value: "groupe", label: "par groupe" },
  { value: "forfait", label: "forfait" },
  { value: "heure", label: "par heure" },
];

function NewPricingModal({
  companies,
  onClose,
  onCreated,
}: {
  companies: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState("");
  const [priceHt, setPriceHt] = useState("");
  const [unit, setUnit] = useState("split");
  const [companyId, setCompanyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    if (!label) { setError("Le libellé est requis"); return; }
    if (!priceHt) { setError("Le prix HT est requis"); return; }
    setSaving(true);

    const token = await getToken();
    if (!token) { setError("Session expirée, reconnectez-vous"); setSaving(false); return; }

    try {
      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          label,
          price_ht: parseFloat(priceHt),
          unit,
          company_id: companyId || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        onCreated();
      } else {
        console.error("[tarifs] Create failed:", json);
        setError(json.error || "Erreur lors de la création du tarif");
      }
    } catch (err) {
      console.error("[tarifs] Create error:", err);
      setError("Erreur réseau, réessayez");
    }
    setSaving(false);
  }

  const inputCls =
    "w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1]/50 focus:ring-2 focus:ring-[#6366f1]/10 transition-all";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Nouveau tarif</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label className={labelCls}>Libellé</label>
            <input
              className={inputCls}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Installation split mural"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Prix HT</label>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={priceHt}
                onChange={(e) => setPriceHt(e.target.value)}
                placeholder="65.00"
              />
            </div>
            <div>
              <label className={labelCls}>Unité</label>
              <select
                className={inputCls}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Société</label>
            <select
              className={inputCls}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Toutes les sociétés</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {"Laisser sur « Toutes » pour un tarif général applicable à toutes les sociétés"}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !label || !priceHt}
              className="px-5 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "Enregistrement..." : "Créer le tarif"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
