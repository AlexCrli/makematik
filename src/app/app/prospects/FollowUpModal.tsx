"use client";

import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase-client";

const FOLLOW_UP_TYPES = [
  { key: "call", label: "Appel", icon: "📞" },
  { key: "email", label: "Email", icon: "✉️" },
  { key: "sms", label: "SMS", icon: "💬" },
  { key: "voicemail", label: "Message vocal", icon: "🎙️" },
];

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

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const btnCls = "px-4 py-2 text-sm font-medium rounded-lg transition-colors";

export function NewFollowUpModal({
  clientId,
  onClose,
  onCreated,
}: {
  clientId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [action, setAction] = useState("call");
  const [comment, setComment] = useState("");
  const [nextDate, setNextDate] = useState("");

  async function handleSubmit() {
    setSending(true);
    const token = await getToken();
    if (!token) {
      console.error("[follow-up] No auth token");
      setSending(false);
      return;
    }

    try {
      // 1. Create follow-up
      const res = await fetch(`/api/clients/${clientId}/follow-ups`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          action,
          comment: comment || null,
          performed_at: new Date().toISOString(),
          next_contact_date: nextDate || null,
        }),
      });
      const json = await res.json();
      console.log("[follow-up] POST response:", res.status, json);

      if (!res.ok) {
        console.error("[follow-up] POST failed:", json);
        setSending(false);
        return;
      }

      // 2. Auto-set status to "to_recall"
      const putRes = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ status: "to_recall" }),
      });
      const putJson = await putRes.json();
      console.log("[follow-up] PUT status response:", putRes.status, putJson);

      // 3. Close modal and refresh
      onCreated();
      onClose();
    } catch (err) {
      console.error("[follow-up] Error:", err);
    }
    setSending(false);
  }

  const inputCls =
    "w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1]/50 focus:ring-2 focus:ring-[#6366f1]/10 transition-all";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

  const timingPresets = [
    { label: "Demain", days: 1 },
    { label: "Dans 3 jours", days: 3 },
    { label: "Dans 1 semaine", days: 7 },
    { label: "Dans 2 semaines", days: 14 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Nouvelle relance</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Type de relance</label>
            <div className="grid grid-cols-4 gap-2">
              {FOLLOW_UP_TYPES.map((ft) => (
                <button
                  key={ft.key}
                  onClick={() => setAction(ft.key)}
                  className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                    action === ft.key
                      ? "border-[#6366f1] bg-[#6366f1]/5 text-[#6366f1] font-medium"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <span className="text-lg">{ft.icon}</span>
                  <span className="text-xs">{ft.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes / contenu</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Détails de la relance..."
            />
          </div>

          <div>
            <label className={labelCls}>Prochaine relance</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {timingPresets.map((p) => (
                <button
                  key={p.days}
                  onClick={() => setNextDate(addDays(p.days))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    nextDate === addDays(p.days)
                      ? "border-[#6366f1] bg-[#6366f1]/5 text-[#6366f1]"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              className={inputCls}
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Met à jour la date de prochaine relance du prospect</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              onClick={onClose}
              className={`${btnCls} text-gray-600 hover:text-gray-800 border border-gray-200 hover:bg-gray-50`}
            >
              Annuler
            </button>
            <Link
              href={`/app/prospects/${clientId}/rdv`}
              className={`${btnCls} text-green-700 border border-green-200 bg-green-50 hover:bg-green-100`}
            >
              Prendre RDV
            </Link>
            <Link
              href={`/app/prospects/${clientId}/devis`}
              className={`${btnCls} text-purple-700 border border-purple-200 bg-purple-50 hover:bg-purple-100`}
            >
              Créer un devis
            </Link>
            <button
              onClick={handleSubmit}
              disabled={sending}
              className={`${btnCls} bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-40 text-white`}
            >
              {sending ? "Validation..." : "Valider"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
