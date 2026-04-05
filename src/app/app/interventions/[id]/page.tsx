"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  company_id: string | null;
  company_name: string | null;
  nb_splits: number | null;
  height_group: string | null;
  last_maintenance: string | null;
  brand: string | null;
  notes: string | null;
}

interface Quote {
  id: string;
  quote_number: string | null;
  total_ttc: number | null;
  total_ht: number | null;
  tva_rate: number | null;
  tax_credit_amount: number | null;
}

interface QuoteLine {
  id: string;
  quote_id: string;
  label: string;
  quantity: number;
  unit_price_ht: number;
  total_ht: number;
}

interface InterventionAssignee {
  profile_id: string;
  full_name: string;
  color: string | null;
}

interface Intervention {
  id: string;
  client_id: string;
  company_id: string | null;
  assigned_to: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  status: string;
  field_notes: string | null;
  quote_id: string | null;
  payment_method: string | null;
  payment_amount: number | null;
  completed_at: string | null;
  client: Client | null;
  assignee_name: string | null;
  assignees?: InterventionAssignee[];
  quote: Quote | null;
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
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  planned: { label: "Planifié", bg: "bg-blue-100", text: "text-blue-700" },
  in_progress: { label: "En cours", bg: "bg-orange-100", text: "text-orange-700" },
  completed: { label: "Terminé", bg: "bg-green-100", text: "text-green-700" },
  cancelled: { label: "Annulé", bg: "bg-red-100", text: "text-red-700" },
};

const HEIGHT_MAP: Record<string, string> = {
  low: "Basse", medium: "Moyenne", high: "Haute", very_high: "Très haute",
};

const MAINTENANCE_MAP: Record<string, string> = {
  less_1y: "Moins d'1 an", "1_2y": "1 à 2 ans", more_2y: "Plus de 2 ans", never: "Jamais",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Espèces", check: "Chèque", card: "CB", deferred: "Facture différée",
};

const DAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function formatDateFr(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const h = parseInt(timeStr.slice(0, 2));
  const min = timeStr.slice(3, 5);
  return `${DAYS_FR[date.getDay()]} ${d} ${MONTHS_FR[date.getMonth()]} à ${h}h${min === "00" ? "" : min}`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h00`;
}

function fullAddress(client: Client): string {
  return [client.address, client.postal_code, client.city].filter(Boolean).join(", ");
}

function fmtEur(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function InterventionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Field notes
  const [fieldNotes, setFieldNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Quote lines
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [quoteTotals, setQuoteTotals] = useState<{ total_ht: number; tva_rate: number; total_ttc: number; tax_credit_amount: number }>({ total_ht: 0, tva_rate: 20, total_ttc: 0, tax_credit_amount: 0 });
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", price: "" });
  const [showAddLine, setShowAddLine] = useState(false);
  const [newLine, setNewLine] = useState({ label: "", price: "" });
  const [savingLine, setSavingLine] = useState(false);

  // Closure
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [closing, setClosing] = useState(false);

  // Client quotes for selector
  const [clientQuotes, setClientQuotes] = useState<{ id: string; quote_number: string; total_ttc: number; status: string }[]>([]);

  // UI
  const [showNavChoice, setShowNavChoice] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" } | null>(null);

  // Fetch intervention
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch(`/api/interventions/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { setError("Intervention introuvable"); setLoading(false); return; }
        const json = await res.json();
        const iv = json.intervention as Intervention;
        setIntervention(iv);
        setFieldNotes(iv.field_notes ?? "");
        setPaymentMethod(iv.payment_method ?? null);
        setPaymentAmount(iv.payment_amount != null ? String(iv.payment_amount) : (iv.quote?.total_ttc != null ? String(iv.quote.total_ttc) : ""));
        if (iv.quote) {
          setQuoteTotals({
            total_ht: iv.quote.total_ht ?? 0,
            tva_rate: iv.quote.tva_rate ?? 20,
            total_ttc: iv.quote.total_ttc ?? 0,
            tax_credit_amount: iv.quote.tax_credit_amount ?? 0,
          });
        }
      } catch { setError("Erreur de chargement"); }
      setLoading(false);
    })();
  }, [id]);

  // Fetch client quotes for selector
  useEffect(() => {
    if (!intervention?.client?.id) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await fetch(`/api/quotes?client_id=${intervention.client!.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        setClientQuotes(json.quotes ?? []);
      } catch { setClientQuotes([]); }
    })();
  }, [intervention?.client?.id]);

  // Fetch quote lines
  const fetchLines = useCallback(async () => {
    if (!intervention?.quote_id) return;
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/quotes/${intervention.quote_id}/lines`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setQuoteLines(json.lines ?? []);
      // Recalculate totals client-side
      const lines: QuoteLine[] = json.lines ?? [];
      const totalHt = lines.reduce((s, l) => s + l.quantity * l.unit_price_ht, 0);
      const tvaRate = quoteTotals.tva_rate;
      const totalTtc = totalHt * (1 + tvaRate / 100);
      setQuoteTotals((prev) => ({ ...prev, total_ht: totalHt, total_ttc: totalTtc }));
      setPaymentAmount(String(totalTtc.toFixed(2)));
    } catch { /* empty */ }
  }, [intervention?.quote_id, quoteTotals.tva_rate]);

  useEffect(() => { fetchLines(); }, [fetchLines]);

  async function updateIntervention(updates: Record<string, unknown>) {
    const token = await getToken();
    if (!token) return false;
    const res = await fetch(`/api/interventions/${id}`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(updates),
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json.intervention) setIntervention((prev) => prev ? { ...prev, ...json.intervention } : prev);
    return true;
  }

  async function handleChangeQuote(newQuoteId: string | null) {
    const ok = await updateIntervention({ quote_id: newQuoteId });
    if (ok) {
      // Refetch intervention to get updated quote data
      const token = await getToken();
      if (token) {
        const res = await fetch(`/api/interventions/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          const iv = json.intervention as Intervention;
          setIntervention(iv);
          if (iv.quote) {
            setQuoteTotals({
              total_ht: iv.quote.total_ht ?? 0,
              tva_rate: iv.quote.tva_rate ?? 20,
              total_ttc: iv.quote.total_ttc ?? 0,
              tax_credit_amount: iv.quote.tax_credit_amount ?? 0,
            });
          }
        }
      }
    }
  }

  async function handleStart() {
    const ok = await updateIntervention({ status: "in_progress" });
    if (ok && intervention) setIntervention({ ...intervention, status: "in_progress" });
  }

  async function handleSaveNotes() {
    setSavingNotes(true); setNotesSaved(false);
    const ok = await updateIntervention({ field_notes: fieldNotes });
    if (ok) { setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2000); }
    setSavingNotes(false);
  }

  async function handleClose() {
    if (!paymentMethod) return;
    setClosing(true);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const completedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const ok = await updateIntervention({
      status: "completed", field_notes: fieldNotes,
      payment_method: paymentMethod,
      payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
      completed_at: completedAt,
    });

    if (ok && intervention?.client) {
      const token = await getToken();
      if (token) {
        // Update client status
        await fetch(`/api/clients/${intervention.client.id}`, {
          method: "PUT", headers: authHeaders(token),
          body: JSON.stringify({ status: "client" }),
        });

        // Generate invoice
        const invoiceLines = quoteLines.length > 0
          ? quoteLines.map((l) => ({ label: l.label, quantity: l.quantity, unit_price: l.unit_price_ht }))
          : paymentAmount
            ? [{ label: "Intervention", quantity: 1, unit_price: quoteTotals.total_ht || parseFloat(paymentAmount) / 1.2 }]
            : [];

        const totalHt = invoiceLines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

        const invoiceRes = await fetch("/api/invoices", {
          method: "POST", headers: authHeaders(token),
          body: JSON.stringify({
            company_id: intervention.company_id,
            client_id: intervention.client.id,
            intervention_id: intervention.id,
            quote_id: intervention.quote_id,
            payment_method: paymentMethod,
            total_ht: totalHt,
            tva_rate: quoteTotals.tva_rate,
            tax_credit_applicable: quoteTotals.tax_credit_amount > 0,
            tax_credit_rate: quoteTotals.tax_credit_amount > 0 ? Math.round((quoteTotals.tax_credit_amount / quoteTotals.total_ttc) * 100) : 0,
            lines: invoiceLines,
          }),
        });

        // Auto-send invoice email
        let emailSent = false;
        if (invoiceRes.ok) {
          const invoiceJson = await invoiceRes.json();
          const invoiceId = invoiceJson.invoice?.id;
          if (invoiceId) {
            try {
              const emailRes = await fetch(`/api/invoices/${invoiceId}/send-email`, {
                method: "POST", headers: authHeaders(token),
              });
              const emailJson = await emailRes.json();
              emailSent = emailRes.ok && emailJson.success;
            } catch { /* email send failed silently */ }
          }
        }

        // Record follow-up for intervention completion
        const paymentLabel = paymentMethod ? (({ cash: "Espèces", check: "Chèque", card: "CB", deferred: "Facture différée" } as Record<string, string>)[paymentMethod] ?? paymentMethod) : "";
        const amountStr = paymentAmount ? `${parseFloat(paymentAmount).toFixed(2).replace(".", ",")} €` : "—";
        const dateStr = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
        await fetch(`/api/clients/${intervention.client.id}/follow-ups`, {
          method: "POST", headers: authHeaders(token),
          body: JSON.stringify({
            action: "call",
            comment: `Intervention effectuée le ${dateStr} — ${amountStr} (${paymentLabel})`,
            performed_at: new Date().toISOString(),
          }),
        });

        if (emailSent) {
          setToast({ message: "Intervention clôturée et facture envoyée par email", type: "success" });
        } else {
          setToast({ message: "Intervention clôturée. La facture n'a pas pu être envoyée par email.", type: "warning" });
        }
        setTimeout(() => setToast(null), 4000);
      }
      setIntervention((prev) => prev ? { ...prev, status: "completed" } : prev);
    }
    setClosing(false);
  }

  // Quote line CRUD
  async function handleSaveLine(lineId: string) {
    setSavingLine(true);
    const token = await getToken();
    if (!token || !intervention?.quote_id) { setSavingLine(false); return; }
    const price = parseFloat(editForm.price) || 0;
    const res = await fetch(`/api/quotes/${intervention.quote_id}/lines/${lineId}`, {
      method: "PUT", headers: authHeaders(token),
      body: JSON.stringify({
        label: editForm.label,
        quantity: 1,
        unit_price_ht: price,
      }),
    });
    if (!res.ok) console.error("[intervention] PUT line error:", await res.text());
    setEditingLine(null);
    await fetchLines();
    setSavingLine(false);
  }

  async function handleDeleteLine(lineId: string) {
    const token = await getToken();
    if (!token || !intervention?.quote_id) return;
    const res = await fetch(`/api/quotes/${intervention.quote_id}/lines/${lineId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) console.error("[intervention] DELETE line error:", await res.text());
    await fetchLines();
  }

  async function handleAddLine() {
    setSavingLine(true);
    const token = await getToken();
    if (!token || !intervention?.quote_id) { setSavingLine(false); return; }
    const price = parseFloat(newLine.price) || 0;
    const res = await fetch(`/api/quotes/${intervention.quote_id}/lines`, {
      method: "POST", headers: authHeaders(token),
      body: JSON.stringify({
        label: newLine.label,
        quantity: 1,
        unit_price_ht: price,
      }),
    });
    if (!res.ok) console.error("[intervention] POST line error:", await res.text());
    setNewLine({ label: "", price: "" });
    setShowAddLine(false);
    await fetchLines();
    setSavingLine(false);
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !intervention) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-600 text-lg">{error || "Intervention introuvable"}</p>
        <button onClick={() => router.back()} className="text-[#6366f1] font-medium">
          Retour aux interventions
        </button>
      </div>
    );
  }

  const client = intervention.client;
  const status = STATUS_MAP[intervention.status] ?? STATUS_MAP.planned;
  const addr = client ? fullAddress(client) : "";
  const encodedAddr = encodeURIComponent(addr);
  const isPlanned = intervention.status === "planned";
  const isInProgress = intervention.status === "in_progress";
  const isCompleted = intervention.status === "completed";

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-20 bg-[#F5F7FA] pb-3 pt-1">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg hover:bg-gray-200 transition-colors">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {client ? `${client.first_name} ${client.last_name}` : "—"}
            </h1>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text} shrink-0`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  PLANNED VIEW                                                 */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {isPlanned && (
        <>
          {/* Big action buttons */}
          <div className="relative mb-3">
            <button
              onClick={() => setShowNavChoice(!showNavChoice)}
              className="w-full flex items-center justify-center gap-3 py-4 bg-[#6366f1] rounded-xl text-white text-lg font-semibold active:bg-[#818cf8]"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              Y aller
            </button>
            {showNavChoice && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowNavChoice(false)} />
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-40">
                  <a href={`https://maps.google.com/?q=${encodedAddr || "France"}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100"
                    onClick={() => setShowNavChoice(false)}>
                    <span className="text-2xl">🗺️</span>
                    <span className="text-base font-medium text-gray-800">Google Maps</span>
                  </a>
                  <a href={`https://waze.com/ul?q=${encodedAddr || "France"}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:bg-gray-100"
                    onClick={() => setShowNavChoice(false)}>
                    <span className="text-2xl">🚗</span>
                    <span className="text-base font-medium text-gray-800">Waze</span>
                  </a>
                </div>
              </>
            )}
          </div>

          <button onClick={handleStart}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white text-lg font-semibold rounded-xl transition-colors mb-5">
            {"Commencer l'intervention"}
          </button>

          {/* Compact summary */}
          <Card title="">
            <div className="space-y-3">
              {client && (
                <div className="flex items-center justify-between">
                  <span className="text-base font-medium text-gray-900">{client.first_name} {client.last_name}</span>
                  {client.phone && (
                    <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 rounded-lg text-green-700 text-sm font-medium active:bg-green-100">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                      </svg>
                      {client.phone}
                    </a>
                  )}
                </div>
              )}
              {addr && <p className="text-sm text-gray-500">{addr}</p>}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{formatDateFr(intervention.scheduled_date, intervention.scheduled_time)}</span>
                <span className="text-gray-300">·</span>
                <span>{formatDuration(intervention.duration_minutes)}</span>
              </div>
              {client?.nb_splits != null && (
                <p className="text-sm text-gray-600">{client.nb_splits} splits</p>
              )}
              {client?.company_name && (
                <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                  {client.company_name}
                </span>
              )}
            </div>
          </Card>

          {/* Expandable details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm mb-4 text-sm font-medium text-gray-600"
          >
            Voir plus de détails
            <svg className={`w-4 h-4 transition-transform ${showDetails ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {showDetails && <DetailCards client={client} intervention={intervention} />}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  IN PROGRESS VIEW                                             */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {isInProgress && (
        <>
          {/* Quick info bar */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {client ? `${client.first_name} ${client.last_name}` : "—"}
              {addr ? ` — ${client?.city}` : ""}
            </div>
            <div className="flex gap-2">
              {client?.phone && (
                <a href={`tel:${client.phone}`} className="p-2 rounded-lg bg-green-50 text-green-700 active:bg-green-100">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </a>
              )}
              {addr && (
                <a href={`https://maps.google.com/?q=${encodedAddr}`} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-indigo-50 text-indigo-700 active:bg-indigo-100">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Notes terrain */}
          <Card title="Notes terrain">
            <textarea value={fieldNotes}
              onChange={(e) => { setFieldNotes(e.target.value); setNotesSaved(false); }}
              placeholder="Observations, état des splits, remarques..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]"
            />
            <button onClick={handleSaveNotes} disabled={savingNotes}
              className="w-full mt-3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-base font-medium rounded-xl transition-colors disabled:opacity-50">
              {savingNotes ? "Sauvegarde..." : notesSaved ? "Sauvegardé ✓" : "Sauvegarder les notes"}
            </button>
          </Card>

          {/* Quote lines editing */}
          <Card title="Devis">
            {/* Quote selector when client has multiple quotes */}
            {clientQuotes.length > 1 && (
              <div className="mb-3">
                <select
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#6366f1]/50 focus:ring-2 focus:ring-[#6366f1]/10"
                  value={intervention.quote_id ?? ""}
                  onChange={(e) => handleChangeQuote(e.target.value || null)}
                >
                  <option value="">Aucun devis</option>
                  {clientQuotes.map((q) => {
                    const statusLabel = q.status === "sent" ? "Envoyé" : q.status === "draft" ? "Brouillon" : q.status === "accepted" ? "Accepté" : q.status;
                    return (
                      <option key={q.id} value={q.id}>
                        {q.quote_number} — {q.total_ttc.toFixed(2).replace(".", ",")} € — {statusLabel}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            {intervention.quote_id ? (
              <>
                {intervention.quote?.quote_number && clientQuotes.length <= 1 && (
                  <div className="flex items-center justify-between mb-3">
                    <Link href={`/app/devis/${intervention.quote.id}`} className="text-sm text-[#6366f1] font-medium">
                      {intervention.quote.quote_number}
                    </Link>
                  </div>
                )}

                {quoteLines.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">Aucune ligne dans le devis</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {quoteLines.map((line) => (
                      <div key={line.id} className="border border-gray-100 rounded-lg p-3">
                        {editingLine === line.id ? (
                          <div className="space-y-2">
                            <input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                              placeholder="Libellé" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30" />
                            <input type="number" inputMode="decimal" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                              placeholder="Prix HT (€)" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30" />
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveLine(line.id)} disabled={savingLine}
                                className="flex-1 py-2.5 bg-[#6366f1] text-white text-sm font-medium rounded-lg disabled:opacity-50">
                                {savingLine ? "..." : "Enregistrer"}
                              </button>
                              <button onClick={() => setEditingLine(null)}
                                className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg">
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{line.label}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{fmtEur(line.total_ht)}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => { setEditingLine(line.id); setEditForm({ label: line.label, price: String(line.unit_price_ht) }); }}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                </svg>
                              </button>
                              <button onClick={() => handleDeleteLine(line.id)}
                                className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add line */}
                {showAddLine ? (
                  <div className="border border-dashed border-gray-300 rounded-lg p-3 space-y-2 mb-3">
                    <input value={newLine.label} onChange={(e) => setNewLine({ ...newLine, label: e.target.value })}
                      placeholder="Libellé (ex: Nettoyage split supplémentaire)" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30" />
                    <input type="number" inputMode="decimal" value={newLine.price} onChange={(e) => setNewLine({ ...newLine, price: e.target.value })}
                      placeholder="Prix HT (€)" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30" />
                    <div className="flex gap-2">
                      <button onClick={handleAddLine} disabled={savingLine || !newLine.label}
                        className="flex-1 py-2.5 bg-[#6366f1] text-white text-sm font-medium rounded-lg disabled:opacity-50">
                        {savingLine ? "..." : "Ajouter"}
                      </button>
                      <button onClick={() => setShowAddLine(false)}
                        className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddLine(true)}
                    className="w-full py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors mb-3">
                    + Ajouter une ligne
                  </button>
                )}

                {/* Totals */}
                <div className="border-t border-gray-100 pt-3 space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">Total HT</span><span className="font-medium text-gray-700">{fmtEur(quoteTotals.total_ht)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">TVA {quoteTotals.tva_rate}%</span><span className="font-medium text-gray-700">{fmtEur(quoteTotals.total_ht * quoteTotals.tva_rate / 100)}</span></div>
                  <div className="flex justify-between text-base font-bold"><span className="text-gray-900">Total TTC</span><span className="text-indigo-600">{fmtEur(quoteTotals.total_ttc)}</span></div>
                  {quoteTotals.tax_credit_amount > 0 && (
                    <div className="flex justify-between text-sm font-bold"><span className="text-green-600">{"Crédit d'impôt"}</span><span className="text-green-600">-{fmtEur(quoteTotals.tax_credit_amount)}</span></div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 py-2">Aucun devis lié à cette intervention</p>
            )}
          </Card>

          {/* Closure */}
          <div id="closure">
            <Card title="Clôture">
              <p className="text-sm text-gray-500 mb-3">Mode de paiement</p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {([
                  { value: "cash", label: "Espèces" },
                  { value: "check", label: "Chèque" },
                  { value: "card", label: "CB" },
                  { value: "deferred", label: "Facture différée" },
                ] as const).map((opt) => (
                  <button key={opt.value} onClick={() => setPaymentMethod(opt.value)}
                    className={`py-3.5 rounded-xl text-base font-medium border-2 transition-colors ${
                      paymentMethod === opt.value
                        ? "border-[#6366f1] bg-[#6366f1]/10 text-[#6366f1]"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mb-2">{"Montant encaissé (€)"}</p>
              <input type="number" inputMode="decimal" value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00"
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] mb-5" />
              <button onClick={handleClose} disabled={closing || !paymentMethod}
                className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-lg font-semibold rounded-xl transition-colors">
                {"Clôturer l'intervention"}
              </button>
            </Card>
          </div>

          {/* Expandable full details */}
          <button onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm mb-4 text-sm font-medium text-gray-600">
            Voir les détails client
            <svg className={`w-4 h-4 transition-transform ${showDetails ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {showDetails && <DetailCards client={client} intervention={intervention} />}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  COMPLETED VIEW                                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {isCompleted && (
        <>
          <Card title="Récapitulatif">
            <InfoRow label="Client" value={client ? `${client.first_name} ${client.last_name}` : "—"} />
            <InfoRow label="Date" value={formatDateFr(intervention.scheduled_date, intervention.scheduled_time)} />
            {(intervention.assignees?.length ?? 0) > 0
              ? <InfoRow label={intervention.assignees!.length > 1 ? "Intervenants" : "Intervenant"} value={intervention.assignees!.map((a) => a.full_name).join(", ")} />
              : intervention.assignee_name && <InfoRow label="Intervenant" value={intervention.assignee_name} />}
            {client?.company_name && <InfoRow label="Société" value={client.company_name} />}
            {intervention.field_notes && (
              <div className="py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500 block mb-1">Notes terrain</span>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{intervention.field_notes}</p>
              </div>
            )}
            {intervention.payment_method && (
              <InfoRow label="Paiement" value={PAYMENT_LABELS[intervention.payment_method] ?? intervention.payment_method} />
            )}
            {intervention.payment_amount != null && (
              <InfoRow label="Montant" value={fmtEur(intervention.payment_amount)} />
            )}
            {intervention.quote?.quote_number && (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-500">Devis</span>
                <Link href={`/app/devis/${intervention.quote.id}`} className="text-sm font-medium text-[#6366f1]">
                  {intervention.quote.quote_number}
                </Link>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  CANCELLED VIEW                                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {intervention.status === "cancelled" && (
        <Card title="Intervention annulée">
          <InfoRow label="Client" value={client ? `${client.first_name} ${client.last_name}` : "—"} />
          <InfoRow label="Date" value={formatDateFr(intervention.scheduled_date, intervention.scheduled_time)} />
        </Card>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 z-50 px-4 py-2.5 text-white text-sm rounded-lg shadow-lg ${toast.type === "success" ? "bg-gray-900" : "bg-orange-500"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function DetailCards({ client, intervention }: { client: Client | null; intervention: Intervention }) {
  return (
    <>
      {client && (
        <Card title="Infos client">
          <InfoRow label="Nom" value={`${client.first_name} ${client.last_name}`} />
          {fullAddress(client) && <InfoRow label="Adresse" value={fullAddress(client)} />}
          {client.email && (
            <div className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-500">Email</span>
              <a href={`mailto:${client.email}`} className="text-sm font-medium text-[#6366f1] text-right">{client.email}</a>
            </div>
          )}
          {client.company_name && (
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-500">Société</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">{client.company_name}</span>
            </div>
          )}
        </Card>
      )}
      <Card title="Détails RDV">
        <InfoRow label="Date et heure" value={formatDateFr(intervention.scheduled_date, intervention.scheduled_time)} />
        <InfoRow label="Durée" value={formatDuration(intervention.duration_minutes)} />
        {(intervention.assignees?.length ?? 0) > 0
              ? <InfoRow label={intervention.assignees!.length > 1 ? "Intervenants" : "Intervenant"} value={intervention.assignees!.map((a) => a.full_name).join(", ")} />
              : intervention.assignee_name && <InfoRow label="Intervenant" value={intervention.assignee_name} />}
        {intervention.quote?.quote_number && (
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-gray-500">Devis</span>
            <Link href={`/app/devis/${intervention.quote.id}`} className="text-sm font-medium text-[#6366f1]">
              {intervention.quote.quote_number}
            </Link>
          </div>
        )}
      </Card>
      {client && (client.nb_splits || client.height_group || client.last_maintenance || client.brand || client.notes) && (
        <Card title="Informations climatisation">
          {client.nb_splits != null && <InfoRow label="Nombre de splits" value={String(client.nb_splits)} />}
          {client.height_group && <InfoRow label="Groupe de hauteur" value={HEIGHT_MAP[client.height_group] ?? client.height_group} />}
          {client.last_maintenance && <InfoRow label="Dernier entretien" value={MAINTENANCE_MAP[client.last_maintenance] ?? client.last_maintenance} />}
          {client.brand && <InfoRow label="Marque" value={client.brand} />}
          {client.notes && (
            <div className="py-2">
              <span className="text-sm text-gray-500 block mb-1">Notes prospect</span>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
      {title && <h2 className="text-base font-semibold text-gray-900 mb-3">{title}</h2>}
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right ml-4">{value}</span>
    </div>
  );
}
