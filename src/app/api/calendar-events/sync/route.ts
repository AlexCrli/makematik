import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const syncSecret = process.env.SYNC_SECRET_KEY ?? "";

interface SyncEvent {
  google_event_id: string;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  all_day: boolean;
}

export async function POST(request: Request) {
  try {
    // Vérifier la configuration
    if (!supabaseUrl || !serviceKey || !syncSecret) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // Vérifier le header secret
    const key = request.headers.get("x-sync-key");
    if (key !== syncSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { profile_id, events } = body as { profile_id: string; events: SyncEvent[] };

    if (!profile_id || !Array.isArray(events)) {
      return NextResponse.json({ error: "profile_id et events[] requis" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Vérifier que le profil existe et récupérer son organization_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("id", profile_id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    // 2. Supprimer tous les calendar_events existants pour ce profil
    const { error: deleteError } = await supabase
      .from("calendar_events")
      .delete()
      .eq("profile_id", profile_id);

    if (deleteError) {
      console.error("[calendar-events/sync] Delete error:", deleteError.message);
      return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
    }

    // 3. Insérer les nouveaux événements
    if (events.length > 0) {
      const now = new Date().toISOString();
      const rows = events.map((evt) => ({
        organization_id: profile.organization_id,
        profile_id,
        google_event_id: evt.google_event_id,
        title: evt.title,
        start_date: evt.start_date,
        start_time: evt.start_time ?? null,
        end_date: evt.end_date ?? null,
        end_time: evt.end_time ?? null,
        all_day: evt.all_day ?? false,
        synced_at: now,
      }));

      const { error: insertError } = await supabase
        .from("calendar_events")
        .insert(rows);

      if (insertError) {
        console.error("[calendar-events/sync] Insert error:", insertError.message);
        return NextResponse.json({ error: "Erreur lors de l'insertion" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, synced: events.length });
  } catch (err) {
    console.error("[calendar-events/sync] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
