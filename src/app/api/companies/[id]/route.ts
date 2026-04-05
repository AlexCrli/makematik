import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function authenticateAdmin(request: Request) {
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
    .select("organization_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return { error: NextResponse.json({ error: "Profile not found" }, { status: 400 }) };
  }
  if (profile.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) };
  }
  return { supabase, user, organizationId: profile.organization_id as string };
}

/* GET — single company with all fields */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticateAdmin(request);
    if ("error" in auth) return auth.error;
    const { supabase, organizationId } = auth;

    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ company: data });
  } catch (err) {
    console.error("[api/companies/[id] GET] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/* PUT — update company */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticateAdmin(request);
    if ("error" in auth) return auth.error;
    const { supabase, organizationId } = auth;

    const body = await request.json();
    const allowed = [
      "name", "code", "color", "logo_url", "tax_credit_enabled",
      "legal_entity_name", "address", "postal_code", "city", "phone", "email",
      "siret", "tva_mention", "legal_mentions",
      "iban", "bank_account_name",
      "email_subject_quote", "email_template_quote",
      "email_subject_invoice", "email_template_invoice",
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("companies")
      .update(updates)
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .select()
      .single();

    if (error) {
      console.error("[api/companies/[id] PUT] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, company: data });
  } catch (err) {
    console.error("[api/companies/[id] PUT] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/* DELETE — delete company (only if no linked data) */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticateAdmin(request);
    if ("error" in auth) return auth.error;
    const { supabase, organizationId } = auth;

    // Check for linked data
    const checks = await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("company_id", params.id),
      supabase.from("quotes").select("id", { count: "exact", head: true }).eq("company_id", params.id),
      supabase.from("invoices").select("id", { count: "exact", head: true }).eq("company_id", params.id),
      supabase.from("interventions").select("id", { count: "exact", head: true }).eq("company_id", params.id),
    ]);

    const totalLinked = checks.reduce((s, c) => s + (c.count ?? 0), 0);
    if (totalLinked > 0) {
      return NextResponse.json({ error: "Impossible de supprimer : des prospects, devis, factures ou interventions sont li\u00E9s \u00E0 cette marque" }, { status: 400 });
    }

    const { error } = await supabase
      .from("companies")
      .delete()
      .eq("id", params.id)
      .eq("organization_id", organizationId);

    if (error) {
      console.error("[api/companies/[id] DELETE] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/companies/[id] DELETE] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
