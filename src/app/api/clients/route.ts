import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Verify token and return user + organization_id, or an error response. */
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
/*  GET — list clients for the user's organization                     */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("company_id");

    let query = supabase
      .from("clients")
      .select("id, first_name, last_name, phone, city, status, nb_splits, next_contact_date")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[api/clients GET] Error:", error.message);
      return NextResponse.json({ clients: [] });
    }

    return NextResponse.json({ clients: data });
  } catch (err) {
    console.error("[api/clients GET] Unexpected:", err);
    return NextResponse.json({ clients: [] });
  }
}

/* ------------------------------------------------------------------ */
/*  POST — create a new client                                         */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;
    const body = await request.json();

    const row = {
      organization_id: organizationId,
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

    console.log("[api/clients POST] Inserting:", JSON.stringify(row));

    const { data, error } = await supabase.from("clients").insert([row]).select().single();

    if (error) {
      console.error("[api/clients POST] Error:", error.message, error.details, error.hint);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log("[api/clients POST] Success:", data.id);
    return NextResponse.json({ success: true, client: data });
  } catch (err) {
    console.error("[api/clients POST] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
