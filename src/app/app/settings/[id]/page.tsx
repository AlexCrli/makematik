"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { useAppContext } from "../../context";

interface Company {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
  logo_url: string | null;
  tax_credit_enabled: boolean;
  legal_entity_name: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
  tva_mention: string | null;
  legal_mentions: string | null;
  iban: string | null;
  bank_account_name: string | null;
  gmail_connected: boolean;
  gmail_email: string | null;
  email_subject_quote: string | null;
  email_template_quote: string | null;
  email_subject_invoice: string | null;
  email_template_invoice: string | null;
  email_subject_followup_prospect: string | null;
  email_template_followup_prospect: string | null;
  email_subject_followup_quote: string | null;
  email_template_followup_quote: string | null;
  email_subject_followup_invoice: string | null;
  email_template_followup_invoice: string | null;
  followup_quote_days: number | null;
  followup_invoice_days: number | null;
}

async function getToken() {
  if (!supabaseBrowser) return null;
  return (await supabaseBrowser.auth.getSession()).data.session?.access_token ?? null;
}

function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const inputCls = "w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1]/50 focus:ring-2 focus:ring-[#6366f1]/10 transition-all";
const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

export default function CompanyEditPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAppContext();
  const router = useRouter();

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "", code: "", color: "#6366f1", tax_credit_enabled: false,
    legal_entity_name: "", address: "", postal_code: "", city: "",
    phone: "", email: "", siret: "", tva_mention: "", legal_mentions: "",
    iban: "", bank_account_name: "", logo_url: "",
    email_subject_quote: "", email_template_quote: "",
    email_subject_invoice: "", email_template_invoice: "",
    email_subject_followup_prospect: "", email_template_followup_prospect: "",
    email_subject_followup_quote: "", email_template_followup_quote: "",
    email_subject_followup_invoice: "", email_template_followup_invoice: "",
    followup_quote_days: 7, followup_invoice_days: 30,
  });

  const fetchCompany = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/companies/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setError("Marque introuvable"); setLoading(false); return; }
      const json = await res.json();
      const c = json.company as Company;
      setCompany(c);
      setForm({
        name: c.name ?? "",
        code: c.code ?? "",
        color: c.color ?? "#6366f1",
        tax_credit_enabled: c.tax_credit_enabled ?? false,
        legal_entity_name: c.legal_entity_name ?? "",
        address: c.address ?? "",
        postal_code: c.postal_code ?? "",
        city: c.city ?? "",
        phone: c.phone ?? "",
        email: c.email ?? "",
        siret: c.siret ?? "",
        tva_mention: c.tva_mention ?? "",
        legal_mentions: c.legal_mentions ?? "",
        iban: c.iban ?? "",
        bank_account_name: c.bank_account_name ?? "",
        logo_url: c.logo_url ?? "",
        email_subject_quote: c.email_subject_quote ?? "",
        email_template_quote: c.email_template_quote ?? "",
        email_subject_invoice: c.email_subject_invoice ?? "",
        email_template_invoice: c.email_template_invoice ?? "",
        email_subject_followup_prospect: c.email_subject_followup_prospect ?? "",
        email_template_followup_prospect: c.email_template_followup_prospect ?? "",
        email_subject_followup_quote: c.email_subject_followup_quote ?? "",
        email_template_followup_quote: c.email_template_followup_quote ?? "",
        email_subject_followup_invoice: c.email_subject_followup_invoice ?? "",
        email_template_followup_invoice: c.email_template_followup_invoice ?? "",
        followup_quote_days: c.followup_quote_days ?? 7,
        followup_invoice_days: c.followup_invoice_days ?? 30,
      });
    } catch { setError("Erreur de chargement"); }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (role === "tech") { router.replace("/app/planning"); return; }
    fetchCompany();
  }, [role, router, fetchCompany]);

  function updateForm(key: string, value: string | boolean | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setError("");
    if (!form.name.trim()) { setError("Le nom est requis"); return; }
    setSaving(true);
    const token = await getToken();
    if (!token) { setSaving(false); return; }

    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({
          ...form,
          code: form.code.toUpperCase().slice(0, 5),
        }),
      });
      if (res.ok) {
        setToast("Enregistré");
        setTimeout(() => setToast(null), 2500);
        fetchCompany();
      } else {
        const json = await res.json();
        setError(json.error || "Erreur");
      }
    } catch { setError("Erreur réseau"); }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const token = await getToken();
    if (!token) { setDeleting(false); return; }
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        router.push("/app/settings");
      } else {
        const json = await res.json();
        setError(json.error || "Impossible de supprimer");
      }
    } catch { setError("Erreur réseau"); }
    setDeleting(false);
    setConfirmDelete(false);
  }

  async function handleGmailDisconnect() {
    const token = await getToken();
    if (!token) return;
    try {
      await fetch(`/api/gmail/disconnect?company_id=${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchCompany();
    } catch { /* empty */ }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !company) {
    return <div className="text-center py-20 text-gray-500">{error}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => router.push("/app/settings")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        Retour aux paramètres
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {company?.name ?? "Nouvelle marque"}
      </h1>

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      <div className="space-y-8">
        {/* ── Identité ── */}
        <Section title="Identité">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nom de la marque *</label>
              <input className={inputCls} value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="NetVapeur" />
            </div>
            <div>
              <label className={labelCls}>Code (numérotation)</label>
              <input className={inputCls} value={form.code} onChange={(e) => updateForm("code", e.target.value.toUpperCase().slice(0, 5))} placeholder="NV" maxLength={5} />
            </div>
            <div>
              <label className={labelCls}>Couleur</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={(e) => updateForm("color", e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-gray-200" />
                <input className={inputCls} value={form.color} onChange={(e) => updateForm("color", e.target.value)} placeholder="#6366f1" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Logo URL</label>
              <input className={inputCls} value={form.logo_url} onChange={(e) => updateForm("logo_url", e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <label className="flex items-center gap-2.5 mt-4 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={form.tax_credit_enabled}
              onClick={() => updateForm("tax_credit_enabled", !form.tax_credit_enabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${form.tax_credit_enabled ? "bg-[#6366f1]" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${form.tax_credit_enabled ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
            </button>
            <span className="text-sm text-gray-700">Crédit d&apos;impôt activé</span>
          </label>
        </Section>

        {/* ── Infos légales ── */}
        <Section title="Informations légales">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Entité légale</label>
              <input className={inputCls} value={form.legal_entity_name} onChange={(e) => updateForm("legal_entity_name", e.target.value)} placeholder="EI - Andy COGNO" />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <label className={labelCls}>Adresse</label>
                <input className={inputCls} value={form.address} onChange={(e) => updateForm("address", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Code postal</label>
                <input className={inputCls} value={form.postal_code} onChange={(e) => updateForm("postal_code", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Ville</label>
                <input className={inputCls} value={form.city} onChange={(e) => updateForm("city", e.target.value)} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Téléphone</label>
                <input className={inputCls} value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>SIRET</label>
                <input className={inputCls} value={form.siret} onChange={(e) => updateForm("siret", e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Mention TVA</label>
              <textarea className={inputCls} rows={2} value={form.tva_mention} onChange={(e) => updateForm("tva_mention", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Mentions légales</label>
              <textarea className={inputCls} rows={3} value={form.legal_mentions} onChange={(e) => updateForm("legal_mentions", e.target.value)} />
            </div>
          </div>
        </Section>

        {/* ── Coordonnées bancaires ── */}
        <Section title="Coordonnées bancaires">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>IBAN</label>
              <input className={inputCls} value={form.iban} onChange={(e) => updateForm("iban", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Titulaire du compte</label>
              <input className={inputCls} value={form.bank_account_name} onChange={(e) => updateForm("bank_account_name", e.target.value)} />
            </div>
          </div>
        </Section>

        {/* ── Templates email ── */}
        <Section title="Templates email">
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Email devis</h4>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Sujet</label>
                  <input className={inputCls} value={form.email_subject_quote} onChange={(e) => updateForm("email_subject_quote", e.target.value)} placeholder="Devis nettoyage climatisation - ..." />
                </div>
                <div>
                  <label className={labelCls}>Corps du message</label>
                  <textarea className={`${inputCls} resize-none`} rows={8} value={form.email_template_quote} onChange={(e) => updateForm("email_template_quote", e.target.value)} placeholder="Bonjour [civilite] [nom],&#10;&#10;Veuillez trouver ci-joint..." />
                  <p className="text-xs text-gray-400 mt-1">Placeholders disponibles : [civilite] [nom]</p>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Email facture</h4>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Sujet</label>
                  <input className={inputCls} value={form.email_subject_invoice} onChange={(e) => updateForm("email_subject_invoice", e.target.value)} placeholder="Facture nettoyage climatisation - ..." />
                </div>
                <div>
                  <label className={labelCls}>Corps du message</label>
                  <textarea className={`${inputCls} resize-none`} rows={8} value={form.email_template_invoice} onChange={(e) => updateForm("email_template_invoice", e.target.value)} placeholder="Bonjour [civilite] [nom],&#10;&#10;Veuillez trouver ci-joint..." />
                  <p className="text-xs text-gray-400 mt-1">Placeholders disponibles : [civilite] [nom]</p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Templates relance ── */}
        <Section title="Templates relance">
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Relance prospection</h4>
              <p className="text-xs text-gray-400 mb-2">Pour les prospects nouveaux et à rappeler</p>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Sujet</label>
                  <input className={inputCls} value={form.email_subject_followup_prospect} onChange={(e) => updateForm("email_subject_followup_prospect", e.target.value)} placeholder="Nettoyage climatisation - ..." />
                </div>
                <div>
                  <label className={labelCls}>Corps du message</label>
                  <textarea className={`${inputCls} resize-none`} rows={8} value={form.email_template_followup_prospect} onChange={(e) => updateForm("email_template_followup_prospect", e.target.value)} placeholder="Bonjour [civilite] [nom],&#10;&#10;Suite à notre échange..." />
                  <p className="text-xs text-gray-400 mt-1">Placeholders : [civilite] [nom]</p>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Relance devis</h4>
              <p className="text-xs text-gray-400 mb-2">Pour les prospects avec devis envoyé</p>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Sujet</label>
                  <input className={inputCls} value={form.email_subject_followup_quote} onChange={(e) => updateForm("email_subject_followup_quote", e.target.value)} placeholder="Votre devis nettoyage climatisation - ..." />
                </div>
                <div>
                  <label className={labelCls}>Corps du message</label>
                  <textarea className={`${inputCls} resize-none`} rows={8} value={form.email_template_followup_quote} onChange={(e) => updateForm("email_template_followup_quote", e.target.value)} placeholder="Bonjour [civilite] [nom],&#10;&#10;Je me permets de revenir vers vous..." />
                  <p className="text-xs text-gray-400 mt-1">Placeholders : [civilite] [nom]. Le dernier devis est automatiquement joint en PJ.</p>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Relance facture</h4>
              <p className="text-xs text-gray-400 mb-2">Pour les factures impayées</p>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Sujet</label>
                  <input className={inputCls} value={form.email_subject_followup_invoice} onChange={(e) => updateForm("email_subject_followup_invoice", e.target.value)} placeholder="Rappel de paiement - Facture ..." />
                </div>
                <div>
                  <label className={labelCls}>Corps du message</label>
                  <textarea className={`${inputCls} resize-none`} rows={8} value={form.email_template_followup_invoice} onChange={(e) => updateForm("email_template_followup_invoice", e.target.value)} placeholder="Bonjour [civilite] [nom],&#10;&#10;Je me permets de vous relancer..." />
                  <p className="text-xs text-gray-400 mt-1">Placeholders : [civilite] [nom] [numero_facture] [montant_ttc] [date_echeance] [titulaire_compte] [iban]</p>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Délais de relance automatique</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Relancer après X jours (devis envoyé)</label>
                  <input className={inputCls} type="number" min="1" value={form.followup_quote_days} onChange={(e) => updateForm("followup_quote_days", parseInt(e.target.value) || 7)} />
                </div>
                <div>
                  <label className={labelCls}>Relancer après X jours (facture impayée)</label>
                  <input className={inputCls} type="number" min="1" value={form.followup_invoice_days} onChange={(e) => updateForm("followup_invoice_days", parseInt(e.target.value) || 30)} />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Email (Gmail) ── */}
        <Section title="Email">
          <p className="text-sm text-gray-500 mb-4">
            Connectez le compte Gmail de cette marque pour envoyer les devis et factures par email depuis cette adresse.
          </p>
          {company?.gmail_connected ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <svg className="w-5 h-5 text-green-600 shrink-0" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-green-700">Gmail connecté</div>
                {company.gmail_email && <div className="text-xs text-green-600 truncate">{company.gmail_email}</div>}
              </div>
              <button
                onClick={handleGmailDisconnect}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Déconnecter
              </button>
            </div>
          ) : (
            <a
              href={`/api/gmail/auth?company_id=${id}`}
              className="inline-flex items-center gap-3 px-5 py-3 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Connecter Gmail
            </a>
          )}
        </Section>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>

          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm text-red-400 hover:text-red-600 transition-colors"
            >
              Supprimer cette marque
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">Confirmer ?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? "..." : "Oui, supprimer"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 z-50 px-4 py-2.5 bg-gray-900 text-white text-sm rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h3>
      {children}
    </div>
  );
}
