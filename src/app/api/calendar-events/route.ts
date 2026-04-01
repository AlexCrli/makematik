import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function authenticate(request: Request) {
  if (!supabaseUrl || !serviceKey) {
    return { error: NextResponse.json({ error: "Supabase not configured" }, { status: 500 }) };
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { error: NextResponse.json({ error: "Profile not found" }, { status: 400 }) };
  }

  return { supabase, user, organizationId: profile.organization_id as string };
}

/* ------------------------------------------------------------------ */
/*  GET — list Google calendar events (respects sharing permissions)   */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, user, organizationId } = auth;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // Get all profiles to check sharing permissions
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, share_personal_calendar")
      .eq("organization_id", organizationId);

    // Build list of allowed profile_ids: own + those who share
    const allowedIds: string[] = [user.id];
    for (const p of profiles ?? []) {
      if (p.id !== user.id && p.share_personal_calendar) {
        allowedIds.push(p.id);
      }
    }

    let query = supabase
      .from("calendar_events")
      .select("*")
      .eq("organization_id", organizationId)
      .in("profile_id", allowedIds)
      .order("start_date")
      .order("start_time");

    if (startDate) query = query.gte("start_date", startDate);
    if (endDate) query = query.lte("start_date", endDate);

    const { data, error } = await query;

    if (error) {
      console.error("[api/calendar-events GET] Error:", error.message);
      return NextResponse.json({ events: [] });
    }

    return NextResponse.json({ events: data ?? [] });
  } catch (err) {
    console.error("[api/calendar-events GET] Unexpected:", err);
    return NextResponse.json({ events: [] });
  }
}
