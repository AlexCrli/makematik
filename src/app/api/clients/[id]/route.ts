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
/*  GET — single client detail                                         */
/* ------------------------------------------------------------------ */

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Lookup company name
    let company_name: string | null = null;
    if (data.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", data.company_id)
        .single();
      if (company) company_name = company.name;
    }

    return NextResponse.json({ client: { ...data, company_name } });
  } catch (err) {
    console.error("[api/clients/[id] GET] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  PUT — update client (info + status)                                */
/* ------------------------------------------------------------------ */

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;
    const body = await request.json();

    // Verify ownership
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const allowed = [
      "first_name", "last_name", "email", "phone",
      "address", "postal_code", "city", "company_id",
      "nb_splits", "gainable", "nb_groups_ext", "height_group",
      "difficult_access", "has_elevator",
      "last_maintenance", "source", "notes", "civility",
      "status", "next_contact_date",
    ];

    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("clients")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("[api/clients/[id] PUT] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, client: data });
  } catch (err) {
    console.error("[api/clients/[id] PUT] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
