import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidGoogleToken } from "@/lib/google-token";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function POST(request: Request) {
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

    const body = await request.json();
    const { profile_id, summary, description, location, start_datetime, end_datetime } = body;

    if (!profile_id || !summary || !start_datetime || !end_datetime) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const accessToken = await getValidGoogleToken(profile_id);
    if (!accessToken) {
      return NextResponse.json({ error: "Google Calendar non connecté pour ce profil" }, { status: 400 });
    }

    const gcalBody = {
      summary,
      description: description ?? "",
      location: location ?? "",
      start: { dateTime: start_datetime, timeZone: "Europe/Paris" },
      end: { dateTime: end_datetime, timeZone: "Europe/Paris" },
    };

    const gcalRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gcalBody),
      },
    );

    if (!gcalRes.ok) {
      const errText = await gcalRes.text();
      console.error("[google/create-event] Google API error:", gcalRes.status, errText);
      return NextResponse.json({ error: "Erreur Google Calendar" }, { status: 502 });
    }

    const event = await gcalRes.json();
    return NextResponse.json({ success: true, google_event_id: event.id, event });
  } catch (err) {
    console.error("[google/create-event] Unexpected:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
