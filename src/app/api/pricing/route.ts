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
/*  GET — pricing list (optionally filtered by company)                */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("company_id");
    const includeGeneral = searchParams.get("include_general") === "true";
    const activeOnly = searchParams.get("all") !== "true";

    let query = supabase
      .from("pricing")
      .select("id, label, price_ht, unit, is_active, company_id")
      .eq("organization_id", organizationId)
      .order("label");

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    if (companyId && includeGeneral) {
      // Fetch tarifs for this company + general tarifs (company_id IS NULL)
      query = query.or(`company_id.eq.${companyId},company_id.is.null`);
    } else if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[api/pricing GET] Error:", error.message);
      return NextResponse.json({ pricing: [] });
    }

    return NextResponse.json({ pricing: data });
  } catch (err) {
    console.error("[api/pricing GET] Unexpected:", err);
    return NextResponse.json({ pricing: [] });
  }
}

/* ------------------------------------------------------------------ */
/*  POST — create a new pricing item                                   */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;
    const body = await request.json();

    if (!body.label || body.price_ht === undefined) {
      return NextResponse.json({ error: "label et price_ht sont requis" }, { status: 400 });
    }

    const row = {
      organization_id: organizationId,
      company_id: body.company_id || null,
      label: body.label,
      price_ht: body.price_ht,
      unit: body.unit || "split",
      is_active: body.is_active ?? true,
    };

    console.log("[api/pricing POST] Inserting:", JSON.stringify(row));

    const { data, error } = await supabase
      .from("pricing")
      .insert([row])
      .select()
      .single();

    if (error) {
      console.error("[api/pricing POST] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, pricing: data });
  } catch (err) {
    console.error("[api/pricing POST] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
