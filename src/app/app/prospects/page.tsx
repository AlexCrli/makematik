"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { useAppContext } from "../context";
import { NewFollowUpModal } from "./FollowUpModal";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  status: string;
  nb_splits: number | null;
  next_contact_date: string | null;
  company_id: string | null;
  has_pending_invoice?: boolean;
}

const STATUSES = [
  { key: "all", label: "Tous" },
  { key: "new", label: "Nouveau", color: "bg-blue-100 text-blue-700" },
  { key: "to_recall", label: "À rappeler", color: "bg-orange-100 text-orange-700" },
  { key: "quote_sent", label: "Devis envoyé", color: "bg-purple-100 text-purple-700" },
  { key: "rdv_confirmed", label: "RDV confirmé", color: "bg-green-100 text-green-700" },
  { key: "client", label: "Client", color: "bg-teal-100 text-teal-700" },
  { key: "lost", label: "Perdu", color: "bg-red-100 text-red-700" },
];

function statusBadge(status: string) {
  const s = STATUSES.find((st) => st.key === status);
  const color = s?.color ?? "bg-gray-100 text-gray-600";
  const label = s?.label ?? status;
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal: New Prospect Form (3 steps)                                 */
/* ------------------------------------------------------------------ */

const HEIGHT_OPTIONS = [
  { value: "low", label: "Bas" },
  { value: "medium", label: "Moyen" },
  { value: "high", label: "Haut" },
  { value: "very_high", label: "Très haut" },
];
const LAST_MAINTENANCE = [
  { value: "less_1y", label: "Moins d'1 an" },
  { value: "1_2y", label: "1-2 ans" },
  { value: "more_2y", label: "Plus de 2 ans" },
  { value: "never", label: "Jamais" },
];
const SOURCE_OPTIONS = [
  { value: "phone", label: "Téléphone" },
  { value: "web", label: "Web" },
  { value: "referral", label: "Recommandation" },
];

function NewProspectModal({
  onClose,
  onCreated,
  companies,
}: {
  onClose: () => void;
  onCreated: () => void;
  companies: { id: string; name: string }[];
}) {
  const [step, setStep] = useState(1);
  const [sending, setSending] = useState(false);

  // Step 1
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [civility, setCivility] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");

  // Step 2
  const [nbSplits, setNbSplits] = useState("");
  const [gainable, setGainable] = useState(false);
  const [nbGroupesExt, setNbGroupesExt] = useState("");
  const [heightGroupes, setHeightGroupes] = useState("");
  const [difficultAccess, setDifficultAccess] = useState(false);
  const [elevator, setElevator] = useState(false);

  // Step 3
  const [lastMaintenance, setLastMaintenance] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit() {
    setSending(true);
    const payload = {
      company_id: selectedCompanyId || null,
      civility: civility || null,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      address: address || null,
      postal_code: postalCode || null,
      city: city || null,
      nb_splits: nbSplits ? parseInt(nbSplits) : null,
      gainable,
      nb_groups_ext: nbGroupesExt ? parseInt(nbGroupesExt) : null,
      height_group: heightGroupes || null,
      difficult_access: difficultAccess,
      has_elevator: elevator,
      last_maintenance: lastMaintenance || null,
      source: source || null,
      notes: notes || null,
    };

    console.log("[prospects] Submitting new prospect:", payload);

    // Get auth token for the API
    const session = supabaseBrowser
      ? (await supabaseBrowser.auth.getSession()).data.session
      : null;

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      console.log("[prospects] API response:", res.status, json);

      if (res.ok) {
        onCreated();
        onClose();
      }
    } catch (err) {
      console.error("[prospects] Fetch error:", err);
    }
    setSending(false);
  }

  const inputCls =
    "w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1]/50 focus:ring-2 focus:ring-[#6366f1]/10 transition-all";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-gray-900">Nouveau prospect</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                s === step ? "bg-[#6366f1] scale-125" : s < step ? "bg-[#6366f1]/40" : "bg-gray-200"
              }`}
            />
          ))}
          <span className="ml-3 text-xs text-gray-400">
            Étape {step}/3
          </span>
        </div>

        <div className="px-6 pb-6">
          {/* Step 1 — Coordonnées */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Coordonnées</h3>
              <div>
                <label className={labelCls}>Société</label>
                <select className={inputCls} value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)}>
                  <option value="">Aucune société</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Civilité</label>
                <select className={inputCls} value={civility} onChange={(e) => setCivility(e.target.value)}>
                  <option value="">—</option>
                  <option value="M.">M.</option>
                  <option value="Mme">Mme</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Prénom *</label>
                  <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" required />
                </div>
                <div>
                  <label className={labelCls}>Nom *</label>
                  <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" required />
                </div>
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@email.com" />
              </div>
              <div>
                <label className={labelCls}>Téléphone</label>
                <input className={inputCls} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" />
              </div>
              <div>
                <label className={labelCls}>Adresse</label>
                <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 rue des Lilas" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Code postal</label>
                  <input className={inputCls} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="75001" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Ville</label>
                  <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Paris" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Climatisation */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Climatisation</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nombre de splits</label>
                  <input className={inputCls} type="number" min="0" value={nbSplits} onChange={(e) => setNbSplits(e.target.value)} placeholder="3" />
                </div>
                <div>
                  <label className={labelCls}>Groupes extérieurs</label>
                  <input className={inputCls} type="number" min="0" value={nbGroupesExt} onChange={(e) => setNbGroupesExt(e.target.value)} placeholder="1" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Hauteur des groupes</label>
                <select className={inputCls} value={heightGroupes} onChange={(e) => setHeightGroupes(e.target.value)}>
                  <option value="">Sélectionner</option>
                  {HEIGHT_OPTIONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                </select>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <Toggle label="Gainable" checked={gainable} onChange={setGainable} />
                <Toggle label="Accès difficile" checked={difficultAccess} onChange={setDifficultAccess} />
                <Toggle label="Ascenseur" checked={elevator} onChange={setElevator} />
              </div>
            </div>
          )}

          {/* Step 3 — Compléments */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Compléments</h3>
              <div>
                <label className={labelCls}>Dernier entretien</label>
                <select className={inputCls} value={lastMaintenance} onChange={(e) => setLastMaintenance(e.target.value)}>
                  <option value="">Sélectionner</option>
                  {LAST_MAINTENANCE.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Source</label>
                <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="">Sélectionner</option>
                  {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea className={`${inputCls} resize-none`} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informations complémentaires..." />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                Précédent
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && (!firstName || !lastName)}
                className="px-5 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Suivant
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={sending || !firstName || !lastName}
                className="px-5 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {sending ? "Enregistrement..." : "Créer le prospect"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle component                                                   */
/* ------------------------------------------------------------------ */

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-[#6366f1]" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function ProspectsPage() {
  const { companies } = useAppContext();
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("all");
  const [filterCompany, setFilterCompany] = useState("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [followUpClientId, setFollowUpClientId] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
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
      const res = await fetch("/api/clients", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      setClients(json.clients ?? []);
    } catch {
      setClients([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  function companyName(companyId: string | null) {
    if (!companyId) return "—";
    return companies.find((co) => co.id === companyId)?.name ?? "—";
  }

  // Filter
  const filtered = clients.filter((c) => {
    if (filterCompany !== "all" && c.company_id !== filterCompany) return false;
    if (activeStatus !== "all" && c.status !== activeStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${c.first_name} ${c.last_name}`.toLowerCase();
      const city = (c.city ?? "").toLowerCase();
      if (!name.includes(q) && !city.includes(q)) return false;
    }
    return true;
  });

  // Status counts
  const statusCounts: Record<string, number> = { all: clients.length };
  for (const c of clients) {
    statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Prospects{" "}
            <span className="text-base font-normal text-gray-400">
              ({filtered.length})
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
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-medium rounded-lg transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nouveau prospect
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        {/* Status tabs */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-0 overflow-x-auto">
          {STATUSES.map((s) => {
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

        {/* Search */}
        <div className="px-4 py-3 border-t border-gray-50">
          <div className="relative max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher par nom ou ville..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1]/50 focus:ring-2 focus:ring-[#6366f1]/10 transition-all"
            />
          </div>
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2.25 2.25 0 013 16.878V15.12a9.001 9.001 0 0112-8.456M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0112.75 0v.109zM12 9.75a3 3 0 10-6 0 3 3 0 006 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="text-gray-400 text-sm">Aucun prospect pour le moment</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Nom</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Téléphone</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Ville</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Société</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Statut</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Relance</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
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
                  <td className="px-6 py-3.5 text-sm text-gray-600">{companyName(c.company_id)}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1.5">
                      {statusBadge(c.status)}
                      {c.has_pending_invoice && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">Facture impayée</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-gray-600">
                    {c.next_contact_date
                      ? new Date(c.next_contact_date).toLocaleDateString("fr-FR")
                      : "—"}
                  </td>
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
            <p className="text-gray-400 text-sm">Aucun prospect pour le moment</p>
          </div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2"
              onClick={() => router.push(`/app/prospects/${c.id}`)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 text-sm">
                  {c.first_name} {c.last_name}
                </span>
                <div className="flex items-center gap-1.5">
                  {statusBadge(c.status)}
                  {c.has_pending_invoice && (
                    <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">Impayée</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {c.phone && <span>{c.phone}</span>}
                {c.city && <span>{c.city}</span>}
                {c.nb_splits && <span>{c.nb_splits} splits</span>}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-gray-400">
                  {c.next_contact_date
                    ? `Relance : ${new Date(c.next_contact_date).toLocaleDateString("fr-FR")}`
                    : "Pas de relance prévue"}
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
          ))
        )}
      </div>

      {/* Modal — nouveau prospect */}
      {showModal && (
        <NewProspectModal
          onClose={() => setShowModal(false)}
          onCreated={fetchClients}
          companies={companies}
        />
      )}

      {/* Modal — relance */}
      {followUpClientId && (
        <NewFollowUpModal
          clientId={followUpClientId}
          companyId={clients.find((c) => c.id === followUpClientId)?.company_id}
          clientStatus={clients.find((c) => c.id === followUpClientId)?.status}
          clientEmail={clients.find((c) => c.id === followUpClientId)?.email}
          onClose={() => setFollowUpClientId(null)}
          onCreated={() => { setFollowUpClientId(null); fetchClients(); }}
        />
      )}
    </div>
  );
}
