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
/*  GET — single quote with lines                                      */
/* ------------------------------------------------------------------ */

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;

    const { data: quote, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .single();

    if (error || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Fetch lines
    const { data: lines } = await supabase
      .from("quote_lines")
      .select("*")
      .eq("quote_id", quote.id)
      .order("created_at", { ascending: true });

    // Fetch client info
    const { data: client } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone, address, postal_code, city, nb_splits")
      .eq("id", quote.client_id)
      .single();

    // Fetch company name
    const { data: company } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", quote.company_id)
      .single();

    return NextResponse.json({
      quote: {
        ...quote,
        lines: lines ?? [],
        client: client ?? null,
        company: company ?? null,
      },
    });
  } catch (err) {
    console.error("[api/quotes/[id] GET] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  PUT — update quote (lines + status)                                */
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
      .from("quotes")
      .select("id")
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    // Status update
    if (body.status) {
      updates.status = body.status;
      if (body.status === "sent") {
        updates.sent_at = new Date().toISOString();
      }
    }

    // Lines update (replace all lines)
    if (body.lines && Array.isArray(body.lines)) {
      const tvaRate = body.tva_rate ?? 20;
      const taxCreditRate = body.tax_credit_rate ?? 0;

      const totalHt = body.lines.reduce(
        (sum: number, l: { quantity: number; unit_price_ht: number }) =>
          sum + l.quantity * l.unit_price_ht,
        0,
      );
      const totalTtc = totalHt * (1 + tvaRate / 100);
      const taxCreditAmount = totalTtc * (taxCreditRate / 100);

      updates.total_ht = totalHt;
      updates.tva_rate = tvaRate;
      updates.total_ttc = totalTtc;
      updates.tax_credit_amount = taxCreditAmount;

      // Delete old lines and insert new ones
      await supabase.from("quote_lines").delete().eq("quote_id", params.id);

      const lineRows = body.lines.map((l: { label: string; quantity: number; unit_price_ht: number }) => ({
        quote_id: params.id,
        label: l.label,
        quantity: l.quantity,
        unit_price_ht: l.unit_price_ht,
        total_ht: l.quantity * l.unit_price_ht,
      }));

      const { error: linesError } = await supabase
        .from("quote_lines")
        .insert(lineRows);

      if (linesError) {
        console.error("[api/quotes/[id] PUT] Lines error:", linesError.message);
        return NextResponse.json({ error: linesError.message }, { status: 400 });
      }
    }

    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabase
        .from("quotes")
        .update(updates)
        .eq("id", params.id)
        .select()
        .single();

      if (error) {
        console.error("[api/quotes/[id] PUT] Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, quote: data });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/quotes/[id] PUT] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
