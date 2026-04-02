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
/*  GET — single invoice with full details                             */
/* ------------------------------------------------------------------ */

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }

    // Lines
    const { data: lines } = await supabase
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("created_at", { ascending: true });

    // Client
    let client = null;
    if (invoice.client_id) {
      const { data: c } = await supabase
        .from("clients")
        .select("id, first_name, last_name, email, phone, address, postal_code, city")
        .eq("id", invoice.client_id)
        .single();
      if (c) client = c;
    }

    // Company
    let company = null;
    if (invoice.company_id) {
      const { data: co } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", invoice.company_id)
        .single();
      if (co) company = co;
    }

    return NextResponse.json({
      invoice: {
        ...invoice,
        lines: lines ?? [],
        client,
        company,
      },
    });
  } catch (err) {
    console.error("[api/invoices/[id] GET] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  PUT — update invoice (status, payment)                             */
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

    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const allowed = ["status", "payment_method", "payment_date", "late_fee_applied", "notes"];
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
    }

    const { data, error: updateError } = await supabase
      .from("invoices")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      console.error("[api/invoices/[id] PUT] Error:", updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, invoice: data });
  } catch (err) {
    console.error("[api/invoices/[id] PUT] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
