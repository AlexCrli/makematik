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
/*  GET — list companies for the user's organization                   */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;

    const { data, error } = await supabase
      .from("companies")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("name");

    if (error) {
      console.error("[api/companies GET] Error:", error.message);
      return NextResponse.json({ companies: [] });
    }

    return NextResponse.json({ companies: data });
  } catch (err) {
    console.error("[api/companies GET] Unexpected:", err);
    return NextResponse.json({ companies: [] });
  }
}
