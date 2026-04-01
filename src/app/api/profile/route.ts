import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/* ------------------------------------------------------------------ */
/*  GET — current user profile + organization                          */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  try {
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch profile
    console.log("[api/profile GET] Looking up user:", user.id);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, organization_id, role, color")
      .eq("id", user.id)
      .single();

    console.log("[api/profile GET] Profile result:", profile, "Error:", profileError?.message ?? "none");

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 400 });
    }

    // Fetch organization
    const { data: organization } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", profile.organization_id)
      .single();

    return NextResponse.json({
      profile: {
        full_name: profile.full_name,
        organization_id: profile.organization_id,
        role: profile.role,
        color: profile.color,
      },
      organization: organization ?? null,
    });
  } catch (err) {
    console.error("[api/profile GET] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
