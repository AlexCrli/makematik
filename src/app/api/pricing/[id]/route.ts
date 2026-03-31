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
/*  PUT — update a pricing item                                        */
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
      .from("pricing")
      .select("id")
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Pricing not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const allowed = ["label", "price_ht", "unit", "company_id", "is_active"];

    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("pricing")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("[api/pricing/[id] PUT] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, pricing: data });
  } catch (err) {
    console.error("[api/pricing/[id] PUT] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE — deactivate a pricing item (set is_active=false)           */
/* ------------------------------------------------------------------ */

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;

    const { data: existing } = await supabase
      .from("pricing")
      .select("id")
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Pricing not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("pricing")
      .update({ is_active: false })
      .eq("id", params.id);

    if (error) {
      console.error("[api/pricing/[id] DELETE] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/pricing/[id] DELETE] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
