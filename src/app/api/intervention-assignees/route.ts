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
  return { supabase, user };
}

/* GET — list assignees for an intervention */
export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const interventionId = searchParams.get("intervention_id");
    if (!interventionId) {
      return NextResponse.json({ error: "intervention_id requis" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("intervention_assignees")
      .select("id, profile_id")
      .eq("intervention_id", interventionId);

    if (error) {
      console.error("[intervention-assignees GET] Error:", error.message);
      return NextResponse.json({ assignees: [] });
    }

    // Join profile info
    const profileIds = (data ?? []).map((a) => a.profile_id);
    let profilesMap: Record<string, { full_name: string; color: string | null }> = {};
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, color")
        .in("id", profileIds);
      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map((p) => [p.id, { full_name: p.full_name, color: p.color }]));
      }
    }

    const assignees = (data ?? []).map((a) => ({
      id: a.id,
      profile_id: a.profile_id,
      full_name: profilesMap[a.profile_id]?.full_name ?? null,
      color: profilesMap[a.profile_id]?.color ?? null,
    }));

    return NextResponse.json({ assignees });
  } catch (err) {
    console.error("[intervention-assignees GET] Unexpected:", err);
    return NextResponse.json({ assignees: [] });
  }
}

/* POST — bulk create assignees */
export async function POST(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;
    const { supabase } = auth;

    const body = await request.json();
    const { intervention_id, profile_ids } = body;

    if (!intervention_id || !Array.isArray(profile_ids) || profile_ids.length === 0) {
      return NextResponse.json({ error: "intervention_id et profile_ids requis" }, { status: 400 });
    }

    const rows = profile_ids.map((pid: string) => ({
      intervention_id,
      profile_id: pid,
    }));

    const { data, error } = await supabase
      .from("intervention_assignees")
      .upsert(rows, { onConflict: "intervention_id,profile_id" })
      .select();

    if (error) {
      console.error("[intervention-assignees POST] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, assignees: data });
  } catch (err) {
    console.error("[intervention-assignees POST] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
