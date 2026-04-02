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
/*  GET — list profiles (intervenants) for the organization            */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;

    console.log("[api/profiles GET] Fetching for org:", organizationId);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, color, share_personal_calendar, google_calendar_connected, google_email")
      .eq("organization_id", organizationId)
      .order("full_name");

    if (error) {
      console.error("[api/profiles GET] Error:", error.message);
      // Fallback without share_personal_calendar
      const { data: fallback, error: fbErr } = await supabase
        .from("profiles")
        .select("id, full_name, role, color")
        .eq("organization_id", organizationId)
        .order("full_name");

      if (fbErr) {
        console.error("[api/profiles GET] Fallback error:", fbErr.message);
        return NextResponse.json({ profiles: [] });
      }

      const profiles = (fallback ?? []).map((p) => ({ ...p, share_personal_calendar: false }));
      console.log("[api/profiles GET] Returning (fallback)", profiles.length, "profiles");
      return NextResponse.json({ profiles });
    }

    console.log("[api/profiles GET] Found", (data ?? []).length, "profiles");
    return NextResponse.json({ profiles: data ?? [] });
  } catch (err) {
    console.error("[api/profiles GET] Unexpected:", err);
    return NextResponse.json({ profiles: [] });
  }
}
