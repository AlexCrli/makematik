import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidGoogleToken } from "@/lib/google-token";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function GET(request: Request) {
  try {
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
    }

    // Auth utilisateur
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profile_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    if (!profileId || !startDate || !endDate) {
      return NextResponse.json({ error: "profile_id, start_date et end_date requis" }, { status: 400 });
    }

    // Vérifier que le profil demandé est soit le user, soit un profil qui partage son calendrier
    if (profileId !== user.id) {
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("share_personal_calendar")
        .eq("id", profileId)
        .single();

      if (!targetProfile?.share_personal_calendar) {
        return NextResponse.json({ error: "Accès non autorisé à ce calendrier" }, { status: 403 });
      }
    }

    const accessToken = await getValidGoogleToken(profileId);
    if (!accessToken) {
      return NextResponse.json({ events: [] });
    }

    // Appeler l'API Google Calendar
    const timeMin = `${startDate}T00:00:00Z`;
    const timeMax = `${endDate}T23:59:59Z`;

    const gcalParams = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });

    const gcalRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${gcalParams.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!gcalRes.ok) {
      const errText = await gcalRes.text();
      console.error("[google/calendar-events] Google API error:", gcalRes.status, errText);
      return NextResponse.json({ events: [] });
    }

    const gcalData = await gcalRes.json();

    const events = (gcalData.items ?? [])
      .filter((item: Record<string, unknown>) => item.status !== "cancelled")
      .map((item: Record<string, unknown>) => {
        const start = item.start as Record<string, string> | undefined;
        const end = item.end as Record<string, string> | undefined;
        const allDay = !!start?.date;

        let startDateStr = "";
        let startTime: string | null = null;
        let endDateStr: string | null = null;
        let endTime: string | null = null;

        if (allDay) {
          startDateStr = start!.date;
          endDateStr = end?.date ?? null;
        } else {
          const s = new Date(start!.dateTime);
          const e = end?.dateTime ? new Date(end.dateTime) : null;
          startDateStr = s.toISOString().slice(0, 10);
          startTime = s.toTimeString().slice(0, 5);
          if (e) {
            endDateStr = e.toISOString().slice(0, 10);
            endTime = e.toTimeString().slice(0, 5);
          }
        }

        return {
          google_event_id: item.id,
          title: item.summary ?? "(sans titre)",
          start_date: startDateStr,
          start_time: startTime,
          end_date: endDateStr,
          end_time: endTime,
          all_day: allDay,
        };
      });

    return NextResponse.json({ events });
  } catch (err) {
    console.error("[google/calendar-events] Unexpected:", err);
    return NextResponse.json({ events: [] });
  }
}
