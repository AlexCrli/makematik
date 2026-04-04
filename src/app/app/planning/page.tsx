"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-client";
import { useAppContext } from "../context";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Profile {
  id: string;
  full_name: string;
  color: string | null;
  share_personal_calendar: boolean;
  google_calendar_connected?: boolean;
  google_email?: string | null;
}

interface GoogleCalEvent {
  google_event_id: string;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  all_day: boolean;
  profile_id: string;
}

interface ClientInfo {
  first_name: string;
  last_name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  phone: string | null;
  nb_splits: number | null;
  company_id: string | null;
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
  client: ClientInfo | null;
  assignee_name: string | null;
}

interface CalendarEvent {
  id: string;
  profile_id: string;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  all_day: boolean;
}

interface SearchClient {
  id: string;
  first_name: string;
  last_name: string;
  city: string | null;
  nb_splits: number | null;
  company_id: string | null;
  address: string | null;
  postal_code: string | null;
  phone: string | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COLOR_PALETTE = ["#2196F3", "#FF9800", "#4CAF50", "#E91E63", "#9C27B0"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 2) + 7;
  const m = (i % 2) * 30;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
});

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  planned: { label: "Planifié", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "En cours", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Terminé", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-700" },
};

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAYS_FR_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MONTHS_FR_SHORT = ["janv.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function getToken() {
  if (!supabaseBrowser) return null;
  const session = (await supabaseBrowser.auth.getSession()).data.session;
  return session?.access_token ?? null;
}

async function getCurrentUserId() {
  if (!supabaseBrowser) return null;
  const { data: { session } } = await supabaseBrowser.auth.getSession();
  return session?.user?.id ?? null;
}

function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function durationFromSplits(nb: number | null): number {
  if (!nb || nb <= 2) return 60;
  if (nb <= 4) return 90;
  if (nb <= 6) return 120;
  return 150;
}

function getColor(id: string, profiles: Profile[]): string {
  const p = profiles.find((pr) => pr.id === id);
  return p?.color || COLOR_PALETTE[profiles.indexOf(p!) % COLOR_PALETTE.length] || COLOR_PALETTE[0];
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function PlanningPage() {
  const { companies, role } = useAppContext();
  const isAdmin = role === "admin";
  const router = useRouter();
  const searchParams = useSearchParams();
  const prospectIdParam = searchParams.get("prospect_id");
  const quoteIdParam = searchParams.get("quote_id");

  const [view, setView] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(() => getMonday(new Date()));
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [visibleProfiles, setVisibleProfiles] = useState<Set<string>>(new Set());
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [prefillTime, setPrefillTime] = useState<string | null>(null);

  // Google Calendar
  const [googleCalEvents, setGoogleCalEvents] = useState<GoogleCalEvent[]>([]);
  const [myGoogleConnected, setMyGoogleConnected] = useState(false);
  const [myGoogleEmail, setMyGoogleEmail] = useState<string | null>(null);
  const [shareCalendar, setShareCalendar] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Mobile
  const [mobileExpandedDay, setMobileExpandedDay] = useState<string | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Prospect banner mode
  const [pendingProspect, setPendingProspect] = useState<SearchClient | null>(null);
  const [pendingQuoteId, setPendingQuoteId] = useState<string | null>(quoteIdParam);
  const [loadingProspect, setLoadingProspect] = useState(false);

  // Ranges
  const weekStart = view === "week" ? currentDate : new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const weekEnd = view === "week" ? addDays(currentDate, 6) : new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const title = view === "week"
    ? `${fmtDateFr(weekStart)} — ${fmtDateFr(weekEnd)} ${weekStart.getFullYear()}`
    : `${MONTHS_FR[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  // Init: fetch user, profiles, and prospect if in URL
  useEffect(() => {
    (async () => {
      const userId = await getCurrentUserId();
      setCurrentUserId(userId);

      const token = await getToken();
      if (!token) return;

      // Fetch profiles
      try {
        console.log("[planning] Fetching profiles...");
        const res = await fetch("/api/profiles", { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        console.log("[planning] Profiles response:", res.status, json);
        let profs: Profile[] = json.profiles ?? [];
        // Tech users only see their own profile
        if (role !== "admin" && userId) {
          profs = profs.filter((p: Profile) => p.id === userId);
        }
        setProfiles(profs);
        setVisibleProfiles(new Set(profs.map((p: Profile) => p.id)));

        // Statut Google Calendar du profil connecté
        const myProfile = profs.find((p: Profile) => p.id === userId);
        if (myProfile) {
          setMyGoogleConnected(myProfile.google_calendar_connected ?? false);
          setMyGoogleEmail(myProfile.google_email ?? null);
          setShareCalendar(myProfile.share_personal_calendar ?? false);
        }
      } catch (err) {
        console.error("[planning] Profiles fetch error:", err);
      }

      // If prospect_id in URL, load prospect for banner
      if (prospectIdParam) {
        setLoadingProspect(true);
        try {
          const res = await fetch(`/api/clients/${prospectIdParam}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          if (res.ok && json.client) {
            const c = json.client;
            setPendingProspect({
              id: c.id, first_name: c.first_name, last_name: c.last_name,
              city: c.city, nb_splits: c.nb_splits, company_id: c.company_id,
              address: c.address, postal_code: c.postal_code, phone: c.phone,
            });
          }
        } catch { /* empty */ }

        // Auto-resolve quote_id if not provided in URL
        if (!quoteIdParam && prospectIdParam) {
          try {
            const qRes = await fetch(`/api/quotes?client_id=${prospectIdParam}&status=sent,accepted&limit=1`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const qJson = await qRes.json();
            const quotes = qJson.quotes ?? [];
            if (quotes.length > 0) {
              setPendingQuoteId(quotes[0].id);
            }
          } catch { /* empty */ }
        }

        setLoadingProspect(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch events
  const startStr = fmt(weekStart);
  const endStr = fmt(weekEnd);

  // Fetch Google Calendar events for connected profiles
  const fetchGoogleCalEvents = useCallback(async (profs: Profile[]) => {
    const token = await getToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    const connectedProfiles = profs.filter((p) => p.google_calendar_connected);
    if (connectedProfiles.length === 0) { setGoogleCalEvents([]); return; }

    const results = await Promise.all(
      connectedProfiles.map(async (p) => {
        try {
          const res = await fetch(
            `/api/google/calendar-events?profile_id=${p.id}&start_date=${startStr}&end_date=${endStr}`,
            { headers },
          );
          if (!res.ok) return [];
          const json = await res.json();
          return (json.events ?? []).map((e: Omit<GoogleCalEvent, "profile_id">) => ({ ...e, profile_id: p.id }));
        } catch { return []; }
      }),
    );

    setGoogleCalEvents(results.flat());
  }, [startStr, endStr]);

  const fetchEvents = useCallback(async () => {
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [intRes, calRes] = await Promise.all([
        fetch(`/api/interventions?start_date=${startStr}&end_date=${endStr}`, { headers }),
        fetch(`/api/calendar-events?start_date=${startStr}&end_date=${endStr}`, { headers }),
      ]);
      setInterventions((await intRes.json()).interventions ?? []);
      setCalendarEvents((await calRes.json()).events ?? []);
    } catch {
      setInterventions([]);
      setCalendarEvents([]);
    }
    setLoading(false);
  }, [startStr, endStr]);

  useEffect(() => { fetchEvents(); fetchGoogleCalEvents(profiles); }, [fetchEvents, fetchGoogleCalEvents, profiles]);

  // Navigation
  function goToday() {
    setCurrentDate(view === "week" ? getMonday(new Date()) : new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  }
  function goPrev() {
    if (view === "week") setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  }
  function goNext() {
    if (view === "week") setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  }

  // Filtered data
  const filteredInterventions = interventions.filter((i) => visibleProfiles.has(i.assigned_to));
  const filteredCalEvents = isAdmin
    ? calendarEvents.filter((e) => visibleProfiles.has(e.profile_id))
    : calendarEvents; // Tech sees own + shared events (already filtered server-side)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentDate, i));

  // Month grid
  const monthStartDay = (new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const monthCells: (Date | null)[] = [];
  for (let i = 0; i < monthStartDay; i++) monthCells.push(null);
  for (let i = 1; i <= daysInMonth; i++) monthCells.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));

  function toggleProfile(id: string) {
    setVisibleProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Slot click: opens modal, passing pending prospect if any (admin only)
  function handleSlotClick(date: string, time: string) {
    if (!isAdmin) return;
    setPrefillDate(date);
    setPrefillTime(time);
    setShowNewModal(true);
  }

  function isOwn(assignedTo: string): boolean { return assignedTo === currentUserId; }
  function isOwnCal(profileId: string): boolean { return profileId === currentUserId; }
  /** Display title for personal events: own → real title, other → "Occupé" */
  function calTitle(title: string, profileId: string): string { return profileId === currentUserId ? title : "Occupé"; }

  // Google Calendar filtered events (visible profiles only for admin, all for tech)
  const filteredGoogleEvents = isAdmin
    ? googleCalEvents.filter((e) => visibleProfiles.has(e.profile_id))
    : googleCalEvents;

  async function handleGoogleDisconnect() {
    const token = await getToken();
    if (!token) return;
    await fetch("/api/google/disconnect", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setMyGoogleConnected(false);
    setMyGoogleEmail(null);
    setGoogleCalEvents([]);
  }

  async function handleToggleShare() {
    const newVal = !shareCalendar;
    setShareCalendar(newVal); // optimistic
    const token = await getToken();
    if (!token) { setShareCalendar(!newVal); return; }
    try {
      const res = await fetch("/api/profiles/me", {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ share_personal_calendar: newVal }),
      });
      if (!res.ok) { setShareCalendar(!newVal); return; }
      setToastMsg(newVal ? "Agenda partagé" : "Agenda masqué");
      setTimeout(() => setToastMsg(null), 2500);
    } catch {
      setShareCalendar(!newVal);
    }
  }

  const mobileTitle = view === "week"
    ? `Sem. ${weekStart.getDate()}-${weekEnd.getDate()} ${MONTHS_FR_SHORT[weekStart.getMonth()]}`
    : `${MONTHS_FR[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  const pendingCompanyName = pendingProspect?.company_id
    ? companies.find((c) => c.id === pendingProspect.company_id)?.name
    : null;

  return (
    <div>
      {/* Header — Desktop */}
      <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Planning</h1>
        {isAdmin && (
          <button
            onClick={() => { setPrefillDate(null); setPrefillTime(null); setShowNewModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white text-sm font-medium rounded-lg transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Nouveau RDV
          </button>
        )}
      </div>

      {/* Header — Mobile */}
      <div className="md:hidden mb-4">
        <h1 className="text-lg font-bold text-gray-900 mb-3">Planning</h1>
      </div>

      {/* Google Calendar connection */}
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {myGoogleConnected ? (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              <span className="text-green-700 font-medium hidden sm:inline">Google Calendar connecté</span>
              <span className="text-green-700 font-medium sm:hidden">Connecté</span>
              {myGoogleEmail && <span className="text-gray-500 hidden sm:inline">({myGoogleEmail})</span>}
              <button
                onClick={handleGoogleDisconnect}
                className="ml-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Déconnecter
              </button>
            </div>
          ) : (
            <a
              href={`/api/google/auth?profile_id=${currentUserId}`}
              className="inline-flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              <span className="hidden sm:inline">Connecter Google Calendar</span>
              <span className="sm:hidden">Google Calendar</span>
            </a>
          )}
          {myGoogleConnected && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button
                type="button"
                role="switch"
                aria-checked={shareCalendar}
                onClick={handleToggleShare}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${shareCalendar ? "bg-[#6366f1]" : "bg-gray-300"}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${shareCalendar ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
              </button>
              <span className="text-sm text-gray-700">Partager mon agenda</span>
            </label>
          )}
        </div>
        {myGoogleConnected && (
          <p className="text-xs text-gray-400 ml-0.5">
            Si activé, vos événements personnels Google Calendar seront visibles par l&apos;administrateur sur le planning (les détails restent masqués, seuls les créneaux occupés sont affichés).
          </p>
        )}
      </div>

      {/* Prospect banner */}
      {loadingProspect && (
        <div className="mb-4 p-4 rounded-lg bg-blue-50 border-l-4 border-[#2196F3] flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-blue-800">Chargement du prospect...</span>
        </div>
      )}
      {pendingProspect && !loadingProspect && (
        <div className="mb-4 p-4 rounded-lg bg-blue-50 border-l-4 border-[#2196F3] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <svg className="w-5 h-5 text-[#2196F3] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <div className="min-w-0">
              <span className="text-sm font-medium text-blue-900">
                RDV pour {pendingProspect.first_name} {pendingProspect.last_name}
              </span>
              {pendingCompanyName && (
                <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                  {pendingCompanyName}
                </span>
              )}
              <span className="text-sm text-blue-700 ml-2">— Cliquez sur un créneau pour planifier</span>
            </div>
          </div>
          <button
            onClick={() => setPendingProspect(null)}
            className="shrink-0 p-1 text-blue-400 hover:text-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Toolbar — Mobile */}
      <div className="md:hidden bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1">
            <button onClick={goPrev} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>
            <button onClick={goToday} className="px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">{"Auj."}</button>
            <button onClick={goNext} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
          <span className="text-sm font-semibold text-gray-900 truncate">{mobileTitle}</span>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => { setView("week"); setCurrentDate(getMonday(new Date())); }} className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${view === "week" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>Sem.</button>
            <button onClick={() => { setView("month"); setCurrentDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); }} className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${view === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>Mois</button>
          </div>
        </div>
        {isAdmin && profiles.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" /></svg>
              Intervenants ({visibleProfiles.size}/{profiles.length})
            </button>
            {showFilterDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20 min-w-[180px]">
                  {profiles.map((p) => {
                    const color = getColor(p.id, profiles);
                    const checked = visibleProfiles.has(p.id);
                    return (
                      <button key={p.id} onClick={() => toggleProfile(p.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors">
                        <span className="w-3 h-3 rounded-full border-2 shrink-0" style={{ backgroundColor: checked ? color : "transparent", borderColor: color }} />
                        <span className={checked ? "text-gray-700" : "text-gray-400"}>{p.full_name}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Toolbar — Desktop */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button onClick={goPrev} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>
            <button onClick={goToday} className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">{"Aujourd'hui"}</button>
            <button onClick={goNext} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
            <span className="text-sm font-semibold text-gray-900 ml-2">{title}</span>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <div className="flex items-center gap-3">
                {profiles.map((p) => {
                  const color = getColor(p.id, profiles);
                  const checked = visibleProfiles.has(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" checked={checked} onChange={() => toggleProfile(p.id)} className="sr-only" />
                      <span className="w-3 h-3 rounded-full border-2 shrink-0" style={{ backgroundColor: checked ? color : "transparent", borderColor: color }} />
                      <span className={`text-xs font-medium ${checked ? "text-gray-700" : "text-gray-400"}`}>{p.full_name}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => { setView("week"); setCurrentDate(getMonday(new Date())); }} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === "week" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>Semaine</button>
              <button onClick={() => { setView("month"); setCurrentDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); }} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>Mois</button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ==================== MOBILE VIEWS ==================== */}
          <div className="md:hidden">
            {view === "week" ? (
              /* --- Mobile Week: vertical day list --- */
              <div className="space-y-1">
                {weekDays.map((day) => {
                  const dateStr = fmt(day);
                  const isToday = dateStr === fmt(new Date());
                  const dayIdx = (day.getDay() + 6) % 7;
                  const dayIvs = filteredInterventions.filter((iv) => iv.scheduled_date === dateStr).sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
                  const dayCals = filteredCalEvents.filter((e) => e.start_date === dateStr);
                  const dayGCals = filteredGoogleEvents.filter((e) => e.start_date === dateStr);
                  const hasItems = dayIvs.length > 0 || dayCals.length > 0 || dayGCals.length > 0;

                  return (
                    <div key={dateStr}>
                      {/* Day header — sticky */}
                      <div className={`sticky top-0 z-10 px-3 py-2 text-sm font-semibold border-b border-gray-100 ${isToday ? "bg-[#6366f1]/10 text-[#6366f1]" : "bg-gray-50 text-gray-700"}`}>
                        {DAYS_FR_FULL[dayIdx]} {day.getDate()} {MONTHS_FR_SHORT[day.getMonth()]}
                      </div>

                      <div className="bg-white">
                        {!hasItems && (
                          <div className="px-4 py-3 text-sm text-gray-400">Aucun RDV</div>
                        )}

                        {/* Interventions */}
                        {dayIvs.map((iv) => {
                          const color = getColor(iv.assigned_to, profiles);
                          const clientName = iv.client ? `${iv.client.first_name} ${iv.client.last_name}` : "—";
                          const companyName = iv.company_id ? companies.find((c) => c.id === iv.company_id)?.name : null;
                          return (
                            <div
                              key={iv.id}
                              onClick={() => router.push(`/app/interventions/${iv.id}`)}
                              className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 active:bg-gray-50 cursor-pointer"
                            >
                              <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900">{iv.scheduled_time.slice(0, 5)}</span>
                                  <span className="text-sm text-gray-700 truncate">{clientName}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {companyName && (
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 truncate max-w-[120px]">{companyName}</span>
                                  )}
                                  {iv.client?.city && <span className="text-xs text-gray-400 truncate">{iv.client.city}</span>}
                                </div>
                              </div>
                              <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                            </div>
                          );
                        })}

                        {/* Calendar events */}
                        {dayCals.map((evt) => (
                          <div key={evt.id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-50">
                            <div className="w-1 h-6 rounded-full shrink-0 bg-gray-300" />
                            <span className="text-xs text-gray-500">
                              {evt.start_time ?? "Journée"}{evt.end_time ? ` – ${evt.end_time}` : ""}{" "}
                              <span className="text-gray-400">{calTitle(evt.title, evt.profile_id)}</span>
                            </span>
                          </div>
                        ))}

                        {/* Google Calendar events */}
                        {dayGCals.map((gEvt) => {
                          const own = gEvt.profile_id === currentUserId;
                          return (
                            <div key={`g-${gEvt.google_event_id}`} className="flex items-center gap-3 px-4 py-2 border-b border-gray-50">
                              <div className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: own ? "#9E9E9E" : getColor(gEvt.profile_id, profiles) }} />
                              <span className="text-xs text-gray-500">
                                {gEvt.start_time ?? "Journée"}{gEvt.end_time ? ` – ${gEvt.end_time}` : ""}{" "}
                                <span className="text-gray-400">{own ? gEvt.title : "Occupé"}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* --- Mobile Month: compact grid + accordion --- */
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-7 border-b border-gray-100">
                  {DAYS_FR.map((d) => <div key={d} className="py-2 text-center text-[10px] font-semibold text-gray-400 uppercase">{d[0]}</div>)}
                </div>
                <div className="grid grid-cols-7">
                  {monthCells.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`} className="aspect-square border-b border-r border-gray-50 bg-gray-50/30" />;
                    const dateStr = fmt(day);
                    const isToday = dateStr === fmt(new Date());
                    const isExpanded = mobileExpandedDay === dateStr;
                    const dayIvs = filteredInterventions.filter((iv) => iv.scheduled_date === dateStr);
                    const dayGCals = filteredGoogleEvents.filter((e) => e.start_date === dateStr);
                    const dayCals = filteredCalEvents.filter((e) => e.start_date === dateStr);
                    const hasItems = dayIvs.length > 0 || dayCals.length > 0 || dayGCals.length > 0;

                    // Collect unique intervenant colors for dots
                    const dotColors = [...new Set(dayIvs.map((iv) => getColor(iv.assigned_to, profiles)))];

                    return (
                      <div
                        key={dateStr}
                        className={`aspect-square border-b border-r border-gray-50 flex flex-col items-center justify-center cursor-pointer transition-colors ${isToday ? "bg-[#6366f1]/10" : ""} ${isExpanded ? "ring-2 ring-[#6366f1] ring-inset" : ""}`}
                        onClick={() => setMobileExpandedDay(isExpanded ? null : dateStr)}
                      >
                        <span className={`text-sm font-medium ${isToday ? "text-[#6366f1] font-bold" : "text-gray-700"}`}>{day.getDate()}</span>
                        {hasItems && (
                          <div className="flex gap-0.5 mt-0.5">
                            {dotColors.slice(0, 3).map((c, idx) => (
                              <span key={idx} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
                            ))}
                            {(dayCals.length > 0 || dayGCals.length > 0) && dotColors.length === 0 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            )}
                            {(dayCals.length > 0 || dayGCals.length > 0) && dotColors.length > 0 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Accordion: expanded day details */}
                {mobileExpandedDay && (() => {
                  const dayIvs = filteredInterventions.filter((iv) => iv.scheduled_date === mobileExpandedDay).sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
                  const dayCals = filteredCalEvents.filter((e) => e.start_date === mobileExpandedDay);
                  const dayGCals = filteredGoogleEvents.filter((e) => e.start_date === mobileExpandedDay);
                  const expandedDate = new Date(mobileExpandedDay + "T00:00:00");
                  const dayIdx = (expandedDate.getDay() + 6) % 7;

                  return (
                    <div className="border-t border-gray-200 bg-gray-50/50">
                      <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">
                        {DAYS_FR_FULL[dayIdx]} {expandedDate.getDate()} {MONTHS_FR_SHORT[expandedDate.getMonth()]}
                      </div>
                      {dayIvs.length === 0 && dayCals.length === 0 && dayGCals.length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-400">Aucun RDV</div>
                      )}
                      {dayIvs.map((iv) => {
                        const color = getColor(iv.assigned_to, profiles);
                        const clientName = iv.client ? `${iv.client.first_name} ${iv.client.last_name}` : "—";
                        const companyName = iv.company_id ? companies.find((c) => c.id === iv.company_id)?.name : null;
                        return (
                          <div
                            key={iv.id}
                            onClick={() => router.push(`/app/interventions/${iv.id}`)}
                            className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 active:bg-gray-100 cursor-pointer"
                          >
                            <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">{iv.scheduled_time.slice(0, 5)}</span>
                                <span className="text-sm text-gray-700 truncate">{clientName}</span>
                              </div>
                              {companyName && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700">{companyName}</span>
                              )}
                            </div>
                            <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                          </div>
                        );
                      })}
                      {dayCals.map((evt) => (
                        <div key={evt.id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-100">
                          <div className="w-1 h-6 rounded-full shrink-0 bg-gray-300" />
                          <span className="text-xs text-gray-500">
                            {evt.start_time ?? "Journée"}{evt.end_time ? ` – ${evt.end_time}` : ""}{" "}
                            <span className="text-gray-400">{calTitle(evt.title, evt.profile_id)}</span>
                          </span>
                        </div>
                      ))}
                      {dayGCals.map((gEvt) => {
                        const own = gEvt.profile_id === currentUserId;
                        return (
                          <div key={`g-${gEvt.google_event_id}`} className="flex items-center gap-3 px-4 py-2 border-b border-gray-100">
                            <div className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: own ? "#9E9E9E" : getColor(gEvt.profile_id, profiles) }} />
                            <span className="text-xs text-gray-500">
                              {gEvt.start_time ?? "Journée"}{gEvt.end_time ? ` – ${gEvt.end_time}` : ""}{" "}
                              <span className="text-gray-400">{own ? gEvt.title : "Occupé"}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ==================== DESKTOP VIEWS ==================== */}
          <div className="hidden md:block">
            {view === "week" ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-100">
                      <div className="p-2" />
                      {weekDays.map((day) => {
                        const isToday = fmt(day) === fmt(new Date());
                        return (
                          <div key={fmt(day)} className={`p-2 text-center border-l border-gray-100 ${isToday ? "bg-[#6366f1]/5" : ""}`}>
                            <div className="text-xs text-gray-500">{DAYS_FR[(day.getDay() + 6) % 7]}</div>
                            <div className={`text-sm font-semibold ${isToday ? "text-[#6366f1]" : "text-gray-900"}`}>{day.getDate()}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="relative">
                      {HOURS.map((hour) => (
                        <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] h-16 border-b border-gray-50">
                          <div className="text-xs text-gray-400 text-right pr-2 pt-0.5">{hour}h</div>
                          {weekDays.map((day) => (
                            <div key={fmt(day) + hour} className="border-l border-gray-50 relative cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => handleSlotClick(fmt(day), `${hour.toString().padStart(2, "0")}:00`)} />
                          ))}
                        </div>
                      ))}
                      {filteredInterventions.map((iv) => {
                        const dayIdx = weekDays.findIndex((d) => fmt(d) === iv.scheduled_date);
                        if (dayIdx < 0) return null;
                        const startMin = timeToMinutes(iv.scheduled_time) - 7 * 60;
                        const topPx = (startMin / 60) * 64;
                        const heightPx = (iv.duration_minutes / 60) * 64;
                        const color = getColor(iv.assigned_to, profiles);
                        const clientName = iv.client ? `${iv.client.first_name} ${iv.client.last_name}` : "—";
                        return (
                          <div key={iv.id} className="absolute rounded-md px-1.5 py-1 text-white text-xs overflow-hidden cursor-pointer hover:shadow-lg transition-shadow z-10" style={{ top: `${topPx}px`, height: `${Math.max(heightPx, 24)}px`, left: `calc(60px + ${dayIdx} * ((100% - 60px) / 7) + 2px)`, width: `calc((100% - 60px) / 7 - 4px)`, backgroundColor: color, opacity: isOwn(iv.assigned_to) ? 1 : 0.6 }} onClick={(e) => { e.stopPropagation(); router.push(`/app/interventions/${iv.id}`); }}>
                            <div className="font-medium truncate">{iv.scheduled_time.slice(0, 5)} {clientName}</div>
                            {heightPx > 32 && iv.client?.city && <div className="truncate opacity-80">{iv.client.city}</div>}
                          </div>
                        );
                      })}
                      {filteredCalEvents.map((evt) => {
                        const dayIdx = weekDays.findIndex((d) => fmt(d) === evt.start_date);
                        if (dayIdx < 0) return null;
                        const own = isOwnCal(evt.profile_id);
                        const label = calTitle(evt.title, evt.profile_id);
                        const baseStyle = { left: `calc(60px + ${dayIdx} * ((100% - 60px) / 7) + 2px)`, width: `calc((100% - 60px) / 7 - 4px)`, backgroundColor: own ? "#9E9E9E" : "#E0E0E0", color: own ? "#fff" : "#757575", ...(own ? {} : { backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(0,0,0,0.08) 4px, rgba(0,0,0,0.08) 8px)" }) };
                        if (evt.all_day || !evt.start_time) {
                          return <div key={evt.id} className="absolute rounded px-1.5 py-0.5 text-xs overflow-hidden" style={{ top: "0px", height: "20px", ...baseStyle }}><div className="truncate">{label}</div></div>;
                        }
                        const startMin = timeToMinutes(evt.start_time) - 7 * 60;
                        const endMin = evt.end_time ? timeToMinutes(evt.end_time) - 7 * 60 : startMin + 60;
                        return <div key={evt.id} className="absolute rounded px-1.5 py-0.5 text-xs overflow-hidden" style={{ top: `${(startMin / 60) * 64}px`, height: `${Math.max(((endMin - startMin) / 60) * 64, 20)}px`, ...baseStyle }}><div className="truncate">{label}</div></div>;
                      })}
                      {filteredGoogleEvents.map((gEvt) => {
                        const dayIdx = weekDays.findIndex((d) => fmt(d) === gEvt.start_date);
                        if (dayIdx < 0) return null;
                        const own = gEvt.profile_id === currentUserId;
                        const label = calTitle(gEvt.title, gEvt.profile_id);
                        const baseStyle = { left: `calc(60px + ${dayIdx} * ((100% - 60px) / 7) + 2px)`, width: `calc((100% - 60px) / 7 - 4px)`, backgroundColor: own ? "#9E9E9E" : "#E0E0E0", color: own ? "#fff" : "#757575", ...(own ? {} : { backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(0,0,0,0.08) 4px, rgba(0,0,0,0.08) 8px)" }) };
                        if (gEvt.all_day || !gEvt.start_time) {
                          return <div key={`g-${gEvt.google_event_id}`} className="absolute rounded px-1.5 py-0.5 text-xs overflow-hidden" style={{ top: "0px", height: "20px", ...baseStyle }}><div className="truncate">{label}</div></div>;
                        }
                        const startMin = timeToMinutes(gEvt.start_time) - 7 * 60;
                        const endMin = gEvt.end_time ? timeToMinutes(gEvt.end_time) - 7 * 60 : startMin + 60;
                        return <div key={`g-${gEvt.google_event_id}`} className="absolute rounded px-1.5 py-0.5 text-xs overflow-hidden" style={{ top: `${(startMin / 60) * 64}px`, height: `${Math.max(((endMin - startMin) / 60) * 64, 20)}px`, ...baseStyle }}><div className="truncate">{label}</div></div>;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-7 border-b border-gray-100">
                  {DAYS_FR.map((d) => <div key={d} className="p-2 text-center text-xs font-semibold text-gray-500 uppercase">{d}</div>)}
                </div>
                <div className="grid grid-cols-7">
                  {monthCells.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-gray-50 bg-gray-50/30" />;
                    const dateStr = fmt(day);
                    const isToday = dateStr === fmt(new Date());
                    const dayIvs = filteredInterventions.filter((iv) => iv.scheduled_date === dateStr);
                    const dayCals = filteredCalEvents.filter((e) => e.start_date === dateStr);
                    const dayGCals = filteredGoogleEvents.filter((e) => e.start_date === dateStr);
                    return (
                      <div key={dateStr} className={`min-h-[100px] border-b border-r border-gray-50 p-1 cursor-pointer hover:bg-gray-50/50 transition-colors ${isToday ? "bg-[#6366f1]/5" : ""}`} onClick={() => handleSlotClick(dateStr, "09:00")}>
                        <div className={`text-xs font-medium mb-1 ${isToday ? "text-[#6366f1]" : "text-gray-500"}`}>{day.getDate()}</div>
                        <div className="space-y-0.5">
                          {dayIvs.slice(0, 3).map((iv) => (
                            <div key={iv.id} className="text-[10px] text-white rounded px-1 py-0.5 truncate cursor-pointer hover:shadow-sm" style={{ backgroundColor: getColor(iv.assigned_to, profiles), opacity: isOwn(iv.assigned_to) ? 1 : 0.6 }} onClick={(e) => { e.stopPropagation(); router.push(`/app/interventions/${iv.id}`); }}>
                              {iv.scheduled_time.slice(0, 5)} {iv.client ? `${iv.client.first_name} ${iv.client.last_name[0]}.` : "—"}
                            </div>
                          ))}
                          {dayCals.slice(0, 2).map((e) => <div key={e.id} className="text-[10px] rounded px-1 py-0.5 truncate" style={{ backgroundColor: isOwnCal(e.profile_id) ? "#9E9E9E" : "#E0E0E0", color: isOwnCal(e.profile_id) ? "#fff" : "#757575" }}>{calTitle(e.title, e.profile_id)}</div>)}
                          {dayGCals.slice(0, 2).map((e) => <div key={`g-${e.google_event_id}`} className="text-[10px] rounded px-1 py-0.5 truncate" style={{ backgroundColor: e.profile_id === currentUserId ? "#9E9E9E" : "#E0E0E0", color: e.profile_id === currentUserId ? "#fff" : "#757575" }}>{calTitle(e.title, e.profile_id)}</div>)}
                          {dayIvs.length > 3 && <div className="text-[10px] text-gray-400">+{dayIvs.length - 3} de plus</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* New RDV Modal */}
      {showNewModal && (
        <NewRdvModal
          profiles={profiles}
          companies={companies}
          prefillDate={prefillDate}
          prefillTime={prefillTime}
          prefillClient={pendingProspect}
          prefillQuoteId={pendingQuoteId}
          currentUserId={currentUserId}
          onClose={() => setShowNewModal(false)}
          onCreated={() => { setShowNewModal(false); setPendingProspect(null); setPendingQuoteId(null); fetchEvents(); }}
        />
      )}

      {/* Detail Modal */}
      {selectedIntervention && (
        <DetailModal
          intervention={selectedIntervention}
          profiles={profiles}
          companies={companies}
          onClose={() => setSelectedIntervention(null)}
          onUpdated={() => { setSelectedIntervention(null); fetchEvents(); }}
        />
      )}

      {/* Mobile FAB — admin only */}
      {isAdmin && (
        <button
          onClick={() => { setPrefillDate(null); setPrefillTime(null); setShowNewModal(true); }}
          className="md:hidden fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-[#6C63FF] hover:bg-[#818cf8] text-white shadow-lg active:scale-95 transition-transform flex items-center justify-center"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        </button>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 z-50 px-4 py-2.5 bg-gray-900 text-white text-sm rounded-lg shadow-lg animate-[fadeIn_0.2s_ease-out]">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  NewRdvModal                                                        */
/* ================================================================== */

function NewRdvModal({
  profiles,
  companies,
  prefillDate,
  prefillTime,
  prefillClient,
  prefillQuoteId,
  currentUserId,
  onClose,
  onCreated,
}: {
  profiles: Profile[];
  companies: { id: string; name: string }[];
  prefillDate: string | null;
  prefillTime: string | null;
  prefillClient: SearchClient | null;
  prefillQuoteId: string | null;
  currentUserId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<SearchClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<SearchClient | null>(prefillClient);

  const [assignedTo, setAssignedTo] = useState("");
  const [date, setDate] = useState(prefillDate ?? fmt(new Date()));
  const [time, setTime] = useState(prefillTime ?? "09:00");
  const [duration, setDuration] = useState(prefillClient ? durationFromSplits(prefillClient.nb_splits) : 60);
  const [notes, setNotes] = useState("");

  // Set default assignedTo once profiles are available
  useEffect(() => {
    console.log("[planning modal] profiles:", profiles.length, "assignedTo:", assignedTo, "currentUserId:", currentUserId);
    if (profiles.length > 0 && !assignedTo) {
      const match = profiles.find((p) => p.id === currentUserId);
      const newVal = match ? match.id : profiles[0].id;
      console.log("[planning modal] Setting assignedTo to:", newVal);
      setAssignedTo(newVal);
    }
  }, [profiles, currentUserId, assignedTo]);

  // Auto-duration when client changes (manual selection, not prefill)
  useEffect(() => {
    if (selectedClient && selectedClient !== prefillClient) {
      setDuration(durationFromSplits(selectedClient.nb_splits));
    }
  }, [selectedClient, prefillClient]);

  async function searchClients(query: string) {
    setClientSearch(query);
    if (query.length < 2) { setClientResults([]); return; }
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/clients", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      const q = query.toLowerCase();
      setClientResults(
        (json.clients ?? [])
          .filter((c: SearchClient) => `${c.first_name} ${c.last_name} ${c.city ?? ""}`.toLowerCase().includes(q))
          .slice(0, 8)
      );
    } catch { setClientResults([]); }
  }

  async function handleSubmit() {
    setError("");
    if (!selectedClient) { setError("Sélectionnez un prospect"); return; }
    if (!assignedTo) { setError("Sélectionnez un intervenant"); return; }
    if (!date) { setError("Choisissez une date"); return; }

    setSaving(true);
    const token = await getToken();
    if (!token) { setError("Session expirée"); setSaving(false); return; }

    try {
      const res = await fetch("/api/interventions", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          client_id: selectedClient.id,
          company_id: selectedClient.company_id,
          quote_id: prefillQuoteId || null,
          assigned_to: assignedTo,
          scheduled_date: date,
          scheduled_time: time,
          duration_minutes: duration,
          field_notes: notes || null,
        }),
      });
      const json = await res.json();
      if (res.ok) onCreated();
      else setError(json.error || "Erreur lors de la création");
    } catch { setError("Erreur réseau"); }
    setSaving(false);
  }

  const inputCls = "w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-[#6366f1]/50 focus:ring-2 focus:ring-[#6366f1]/10 transition-all";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";
  const companyName = selectedClient?.company_id ? companies.find((c) => c.id === selectedClient.company_id)?.name ?? "—" : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-gray-900">Nouveau RDV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

          {/* Prospect */}
          <div>
            <label className={labelCls}>Prospect</label>
            {selectedClient ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div>
                  <div className="text-sm font-medium text-gray-900">{selectedClient.first_name} {selectedClient.last_name}</div>
                  <div className="text-xs text-gray-500">
                    {[selectedClient.address, selectedClient.city].filter(Boolean).join(", ")}
                    {selectedClient.nb_splits && ` — ${selectedClient.nb_splits} splits`}
                  </div>
                  {companyName && <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700">{companyName}</span>}
                </div>
                <button onClick={() => { setSelectedClient(null); setClientSearch(""); }} className="text-xs text-gray-400 hover:text-gray-600">Changer</button>
              </div>
            ) : (
              <div className="relative">
                <input className={inputCls} placeholder="Rechercher par nom ou ville..." value={clientSearch} onChange={(e) => searchClients(e.target.value)} />
                {clientResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-100 max-h-48 overflow-y-auto">
                    {clientResults.map((c) => (
                      <button key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(""); setClientResults([]); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors">
                        <span className="font-medium text-gray-900">{c.first_name} {c.last_name}</span>
                        {c.city && <span className="text-gray-400 ml-2">{c.city}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Intervenant */}
          <div>
            <label className={labelCls}>Intervenant</label>
            <select
              className={inputCls}
              value={assignedTo}
              onChange={(e) => { console.log("[planning] intervenant changed:", e.target.value); setAssignedTo(e.target.value); }}
            >
              <option value="">Choisir un intervenant</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Date</label>
              <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Heure</label>
              <select className={inputCls} value={time} onChange={(e) => setTime(e.target.value)}>
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className={labelCls}>Durée (minutes)</label>
            <select className={inputCls} value={duration} onChange={(e) => setDuration(parseInt(e.target.value))}>
              <option value="30">30 min</option>
              <option value="60">1h</option>
              <option value="90">1h30</option>
              <option value="120">2h</option>
              <option value="150">2h30</option>
              <option value="180">3h</option>
            </select>
            {selectedClient?.nb_splits && (
              <p className="text-xs text-gray-400 mt-1">Auto-calculé : {selectedClient.nb_splits} splits → {durationFromSplits(selectedClient.nb_splits)} min</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes optionnelles..." />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">Annuler</button>
            <button onClick={handleSubmit} disabled={saving} className="px-5 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
              {saving ? "Planification..." : "Planifier"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  DetailModal                                                        */
/* ================================================================== */

function DetailModal({ intervention, profiles, companies, onClose, onUpdated }: {
  intervention: Intervention; profiles: Profile[]; companies: { id: string; name: string }[];
  onClose: () => void; onUpdated: () => void;
}) {
  const [status, setStatus] = useState(intervention.status);
  const [fieldNotes, setFieldNotes] = useState(intervention.field_notes ?? "");
  const [saving, setSaving] = useState(false);

  const clientName = intervention.client ? `${intervention.client.first_name} ${intervention.client.last_name}` : "—";
  const address = intervention.client ? [intervention.client.address, intervention.client.postal_code, intervention.client.city].filter(Boolean).join(", ") : "—";
  const phone = intervention.client?.phone;
  const companyName = intervention.company_id ? companies.find((c) => c.id === intervention.company_id)?.name : null;
  const color = getColor(intervention.assigned_to, profiles);

  async function handleSave() {
    setSaving(true);
    const token = await getToken();
    if (!token) { setSaving(false); return; }
    try {
      const res = await fetch(`/api/interventions/${intervention.id}`, { method: "PUT", headers: authHeaders(token), body: JSON.stringify({ status, field_notes: fieldNotes || null }) });
      if (res.ok) onUpdated();
    } catch (err) { console.error("[detail] Save error:", err); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Supprimer cette intervention ?")) return;
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/interventions/${intervention.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) onUpdated();
    } catch (err) { console.error("[detail] Delete error:", err); }
  }

  const inputCls = "w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-[#6366f1]/50 focus:ring-2 focus:ring-[#6366f1]/10 transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-gray-900">Détail intervention</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <a href={`/app/prospects/${intervention.client_id}`} className="text-base font-semibold text-[#6366f1] hover:text-[#818cf8] transition-colors">{clientName}</a>
            <p className="text-sm text-gray-500 mt-0.5">{address}</p>
            {phone && <a href={`tel:${phone}`} className="text-sm text-[#6366f1] hover:underline">{phone}</a>}
            <div className="flex items-center gap-2 mt-2">
              {companyName && <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">{companyName}</span>}
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                {intervention.assignee_name ?? "—"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
            <div className="text-center"><div className="text-xs text-gray-500">Date</div><div className="text-sm font-medium text-gray-900">{new Date(intervention.scheduled_date + "T00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</div></div>
            <div className="text-center"><div className="text-xs text-gray-500">Heure</div><div className="text-sm font-medium text-gray-900">{intervention.scheduled_time.slice(0, 5)}</div></div>
            <div className="text-center"><div className="text-xs text-gray-500">Durée</div><div className="text-sm font-medium text-gray-900">{intervention.duration_minutes} min</div></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Statut</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_MAP).map(([key, val]) => (
                <button key={key} onClick={() => setStatus(key)} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${status === key ? `${val.color} border-current` : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>{val.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes terrain</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={fieldNotes} onChange={(e) => setFieldNotes(e.target.value)} placeholder="Notes sur le terrain..." />
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button onClick={handleDelete} className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">Supprimer</button>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">Fermer</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">{saving ? "..." : "Enregistrer"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
