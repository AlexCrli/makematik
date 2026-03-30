import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !serviceKey) {
      console.warn("[api/clients] Supabase not configured");
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    // Extract user token from Authorization header
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      console.error("[api/clients] No auth token");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the user with their token
    const supabaseAuth = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      console.error("[api/clients] Invalid token:", userError?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get organization_id from the user's profile
    const { data: profile, error: profileError } = await supabaseAuth
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("[api/clients] Profile not found:", profileError?.message);
      return NextResponse.json({ error: "Profile not found" }, { status: 400 });
    }

    const body = await request.json();
    console.log("[api/clients] Received from user", user.id, ":", JSON.stringify(body));

    // Build the row with only valid columns
    const row = {
      organization_id: profile.organization_id,
      company_id: body.company_id || null,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      postal_code: body.postal_code || null,
      city: body.city || null,
      nb_splits: body.nb_splits ?? null,
      gainable: body.gainable ?? false,
      nb_groups_ext: body.nb_groups_ext ?? null,
      height_group: body.height_group || null,
      difficult_access: body.difficult_access ?? false,
      has_elevator: body.has_elevator ?? false,
      last_maintenance: body.last_maintenance || null,
      source: body.source || null,
      notes: body.notes || null,
    };

    console.log("[api/clients] Inserting row:", JSON.stringify(row));

    const { data, error } = await supabaseAuth.from("clients").insert([row]).select().single();

    if (error) {
      console.error("[api/clients] Insert error:", error.message, error.details, error.hint);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log("[api/clients] Success:", data.id);
    return NextResponse.json({ success: true, client: data });
  } catch (err) {
    console.error("[api/clients] Unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
