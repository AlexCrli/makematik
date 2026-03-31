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
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("first_name, last_name, organization_id")
      .eq("id", user.id)
      .single();

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
        first_name: profile.first_name,
        last_name: profile.last_name,
        organization_id: profile.organization_id,
      },
      organization: organization ?? null,
    });
  } catch (err) {
    console.error("[api/profile GET] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
