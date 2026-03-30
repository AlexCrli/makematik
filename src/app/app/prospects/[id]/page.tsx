"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { NewFollowUpModal } from "../FollowUpModal";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ClientDetail {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  nb_splits: number | null;
  gainable: boolean;
  nb_groups_ext: number | null;
  height_group: string | null;
  difficult_access: boolean;
  has_elevator: boolean;
  last_maintenance: string | null;
  source: string | null;
  notes: string | null;
  status: string;
  next_contact_date: string | null;
  created_at: string;
  updated_at: string;
}

interface FollowUp {
  id: string;
  client_id: string;
  organization_id: string;
  action: string;
  comment: string | null;
  performed_by: string;
  performed_at: string;
  next_contact_date: string | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUSES = [
  { key: "new", label: "Nouveau", color: "bg-blue-100 text-blue-700" },
  { key: "to_recall", label: "À rappeler", color: "bg-orange-100 text-orange-700" },
  { key: "quote_sent", label: "Devis envoyé", color: "bg-purple-100 text-purple-700" },
  { key: "rdv_confirmed", label: "RDV confirmé", color: "bg-green-100 text-green-700" },
  { key: "client", label: "Client", color: "bg-teal-100 text-teal-700" },
  { key: "lost", label: "Perdu", color: "bg-red-100 text-red-700" },
];

const FOLLOW_UP_TYPES = [
  { key: "call", label: "Appel", icon: "📞" },
  { key: "email", label: "Email", icon: "✉️" },
  { key: "sms", label: "SMS", icon: "💬" },
  { key: "voicemail", label: "Message vocal", icon: "🎙️" },
];

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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

function followUpIcon(action: string) {
  const t = FOLLOW_UP_TYPES.find((ft) => ft.key === action);
  return t?.icon ?? "📋";
}

function followUpLabel(action: string) {
  const t = FOLLOW_UP_TYPES.find((ft) => ft.key === action);
  return t?.label ?? action;
}

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

/* ------------------------------------------------------------------ */
/*  Toggle                                                             */
/* ------------------------------------------------------------------ */

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-[#6366f1]" : "bg-gray-200"}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Edit Modal                                                         */
/* ------------------------------------------------------------------ */

function EditModal({
  client,
  onClose,
  onSaved,
}: {
  client: ClientDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState(client.first_name);
  const [lastName, setLastName] = useState(client.last_name);
  const [email, setEmail] = useState(client.email ?? "");
  const [phone, setPhone] = useState(client.phone ?? "");
  const [address, setAddress] = useState(client.address ?? "");
  const [postalCode, setPostalCode] = useState(client.postal_code ?? "");
  const [city, setCity] = useState(client.city ?? "");
  const [nbSplits, setNbSplits] = useState(client.nb_splits?.toString() ?? "");
  const [gainable, setGainable] = useState(client.gainable);
  const [nbGroupesExt, setNbGroupesExt] = useState(client.nb_groups_ext?.toString() ?? "");
  const [heightGroupes, setHeightGroupes] = useState(client.height_group ?? "");
  const [difficultAccess, setDifficultAccess] = useState(client.difficult_access);
  const [elevator, setElevator] = useState(client.has_elevator);
  const [lastMaintenance, setLastMaintenance] = useState(client.last_maintenance ?? "");
  const [source, setSource] = useState(client.source ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");

  async function handleSave() {
    setSaving(true);
    const token = await getToken();
    if (!token) { setSaving(false); return; }

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
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
        }),
      });
      if (res.ok) {
        onSaved();
        onClose();
      }
    } catch (err) {
      console.error("[edit] Error:", err);
    }
    setSaving(false);
  }

  const inputCls =
    "w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1]/50 focus:ring-2 focus:ring-[#6366f1]/10 transition-all";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-gray-900">Modifier le prospect</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Coordonnées</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Prénom *</label>
              <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Nom *</label>
              <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Téléphone</label>
            <input className={inputCls} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Adresse</label>
            <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Code postal</label>
              <input className={inputCls} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Ville</label>
              <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide pt-2">Climatisation</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nombre de splits</label>
              <input className={inputCls} type="number" min="0" value={nbSplits} onChange={(e) => setNbSplits(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Groupes extérieurs</label>
              <input className={inputCls} type="number" min="0" value={nbGroupesExt} onChange={(e) => setNbGroupesExt(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Hauteur des groupes</label>
            <select className={inputCls} value={heightGroupes} onChange={(e) => setHeightGroupes(e.target.value)}>
              <option value="">Sélectionner</option>
              {HEIGHT_OPTIONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <Toggle label="Gainable" checked={gainable} onChange={setGainable} />
            <Toggle label="Accès difficile" checked={difficultAccess} onChange={setDifficultAccess} />
            <Toggle label="Ascenseur" checked={elevator} onChange={setElevator} />
          </div>

          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide pt-2">Compléments</h3>
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
            <textarea className={`${inputCls} resize-none`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !firstName || !lastName}
              className="px-5 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchClient = useCallback(async () => {
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    try {
      const res = await fetch(`/api/clients/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) setClient(json.client);
    } catch (err) {
      console.error("[detail] Fetch error:", err);
    }
    setLoading(false);
  }, [id]);

  const fetchFollowUps = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/clients/${id}/follow-ups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setFollowUps(json.follow_ups ?? []);
    } catch {
      setFollowUps([]);
    }
  }, [id]);

  useEffect(() => {
    fetchClient();
    fetchFollowUps();
  }, [fetchClient, fetchFollowUps]);

  async function handleStatusChange(newStatus: string) {
    if (!client) return;
    const previousClient = { ...client };
    setUpdatingStatus(true);
    setStatusOpen(false);

    // Optimistic update
    setClient({ ...client, status: newStatus });

    const token = await getToken();
    if (!token) { setUpdatingStatus(false); return; }

    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      console.log("[status] PUT response:", res.status, json);
      if (res.ok && json.client) {
        setClient(json.client);
      } else if (!res.ok) {
        console.error("[status] PUT failed:", json);
        setClient(previousClient);
      }
    } catch (err) {
      console.error("[status] Error:", err);
      setClient(previousClient);
    }
    setUpdatingStatus(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-32">
        <p className="text-gray-400 text-sm">Prospect introuvable</p>
        <button
          onClick={() => router.push("/app/prospects")}
          className="mt-4 text-sm text-[#6366f1] hover:text-[#818cf8] font-medium"
        >
          Retour aux prospects
        </button>
      </div>
    );
  }

  const infoRows: { label: string; value: string }[] = [
    { label: "Adresse", value: client.address ?? "—" },
    { label: "Code postal", value: client.postal_code ?? "—" },
    { label: "Ville", value: client.city ?? "—" },
    { label: "Nombre de splits", value: client.nb_splits?.toString() ?? "—" },
    { label: "Gainable", value: client.gainable ? "Oui" : "Non" },
    { label: "Groupes extérieurs", value: client.nb_groups_ext?.toString() ?? "—" },
    { label: "Hauteur groupe", value: HEIGHT_OPTIONS.find((h) => h.value === client.height_group)?.label ?? client.height_group ?? "—" },
    { label: "Accès difficile", value: client.difficult_access ? "Oui" : "Non" },
    { label: "Ascenseur", value: client.has_elevator ? "Oui" : "Non" },
    { label: "Dernier entretien", value: LAST_MAINTENANCE.find((m) => m.value === client.last_maintenance)?.label ?? client.last_maintenance ?? "—" },
    { label: "Source", value: SOURCE_OPTIONS.find((s) => s.value === client.source)?.label ?? client.source ?? "—" },
    { label: "Notes", value: client.notes ?? "—" },
  ];

  return (
    <div>
      {/* Back link */}
      <button
        onClick={() => router.push("/app/prospects")}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Retour aux prospects
      </button>

      {/* ---- EN-TÊTE ---- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {client.first_name} {client.last_name}
              </h1>
              {statusBadge(client.status)}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-500">
              {client.phone && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  {client.phone}
                </span>
              )}
              {client.email && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  {client.email}
                </span>
              )}
              {client.city && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  {client.city}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status dropdown */}
            <div className="relative">
              <button
                onClick={() => setStatusOpen(!statusOpen)}
                disabled={updatingStatus}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {updatingStatus ? "..." : "Statut"}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {statusOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
                  {STATUSES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => handleStatusChange(s.key)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                        client.status === s.key ? "font-semibold text-[#6366f1]" : "text-gray-700"
                      }`}
                    >
                      {statusBadge(s.key)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Edit button */}
            <button
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#6366f1] hover:bg-[#818cf8] rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Modifier
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ---- INFOS COMPLÈTES ---- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Informations complètes</h2>
          <dl className="space-y-3">
            {infoRows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4">
                <dt className="text-sm text-gray-500 shrink-0">{row.label}</dt>
                <dd className="text-sm text-gray-900 text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ---- HISTORIQUE RELANCES ---- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Historique des relances
              <span className="ml-1.5 text-gray-400">({followUps.length})</span>
            </h2>
            <button
              onClick={() => setShowFollowUp(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#6366f1] bg-[#6366f1]/5 hover:bg-[#6366f1]/10 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nouvelle relance
            </button>
          </div>

          {followUps.length === 0 ? (
            <div className="text-center py-10">
              <svg className="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              <p className="text-gray-400 text-sm">Aucune relance enregistrée</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {followUps.map((fu) => (
                <div key={fu.id} className="flex gap-3 p-3 rounded-lg bg-gray-50/80 border border-gray-100">
                  <span className="text-xl shrink-0 mt-0.5">{followUpIcon(fu.action)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900">{followUpLabel(fu.action)}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(fu.performed_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {fu.comment && (
                      <p className="text-sm text-gray-600 whitespace-pre-line">{fu.comment}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEdit && (
        <EditModal
          client={client}
          onClose={() => setShowEdit(false)}
          onSaved={fetchClient}
        />
      )}
      {showFollowUp && (
        <NewFollowUpModal
          clientId={client.id}
          onClose={() => setShowFollowUp(false)}
          onCreated={() => { fetchClient(); fetchFollowUps(); }}
        />
      )}
    </div>
  );
}
