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
/*  Company code mapping                                               */
/* ------------------------------------------------------------------ */

const COMPANY_CODES: Record<string, string> = {
  "NetVapeur": "NV",
  "Clim Eco Pro": "CEP",
  "Clim50": "C50",
};


/* ------------------------------------------------------------------ */
/*  GET — list quotes for the user's organization                      */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("company_id");
    const clientId = searchParams.get("client_id");

    let query = supabase
      .from("quotes")
      .select("id, quote_number, client_id, company_id, total_ht, tva_rate, total_ttc, tax_credit_amount, status, created_at, sent_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (companyId) {
      query = query.eq("company_id", companyId);
    }
    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const status = searchParams.get("status");
    if (status) {
      query = query.in("status", status.split(","));
    }

    const limit = searchParams.get("limit");
    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const { data, error } = await query;

    if (error) {
      console.error("[api/quotes GET] Error:", error.message);
      return NextResponse.json({ quotes: [] });
    }

    // Fetch client names for display
    const clientIds = [...new Set((data ?? []).map((q) => q.client_id))];
    let clientsMap: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .in("id", clientIds);
      if (clients) {
        clientsMap = Object.fromEntries(
          clients.map((c) => [c.id, `${c.first_name} ${c.last_name}`])
        );
      }
    }

    // Fetch company names
    const companyIds = [...new Set((data ?? []).map((q) => q.company_id))];
    let companiesMap: Record<string, string> = {};
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds);
      if (companies) {
        companiesMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
      }
    }

    const quotes = (data ?? []).map((q) => ({
      ...q,
      client_name: clientsMap[q.client_id] ?? "—",
      company_name: companiesMap[q.company_id] ?? "—",
    }));

    return NextResponse.json({ quotes });
  } catch (err) {
    console.error("[api/quotes GET] Unexpected:", err);
    return NextResponse.json({ quotes: [] });
  }
}

/* ------------------------------------------------------------------ */
/*  POST — create a new quote with lines                               */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;
    const body = await request.json();

    const { company_id, client_id, lines, tva_rate = 20, tax_credit_rate = 0 } = body;

    if (!company_id || !client_id || !lines || lines.length === 0) {
      return NextResponse.json({ error: "company_id, client_id and lines are required" }, { status: 400 });
    }

    // Get company info for quote number generation
    const { data: company } = await supabase
      .from("companies")
      .select("name, code")
      .eq("id", company_id)
      .single();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 400 });
    }

    // Generate quote number: DEV-{CODE}-{YEAR}-{NUM}
    const companyCode = company.code ?? COMPANY_CODES[company.name] ?? "XX";
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company_id)
      .gte("created_at", `${year}-01-01T00:00:00`)
      .lt("created_at", `${year + 1}-01-01T00:00:00`);
    const quoteNumber = `DEV-${companyCode}-${year}-${((count ?? 0) + 1).toString().padStart(3, "0")}`;

    // Calculate totals
    const totalHt = lines.reduce(
      (sum: number, l: { quantity: number; unit_price_ht: number }) =>
        sum + l.quantity * l.unit_price_ht,
      0,
    );
    const totalTtc = totalHt * (1 + tva_rate / 100);
    const taxCreditAmount = totalTtc * (tax_credit_rate / 100);

    // Insert quote
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert([{
        organization_id: organizationId,
        company_id,
        client_id,
        quote_number: quoteNumber,
        total_ht: totalHt,
        tva_rate,
        total_ttc: totalTtc,
        tax_credit_amount: taxCreditAmount,
        status: body.status || "draft",
      }])
      .select()
      .single();

    if (quoteError || !quote) {
      console.error("[api/quotes POST] Quote insert error:", quoteError?.message);
      return NextResponse.json({ error: quoteError?.message ?? "Failed to create quote" }, { status: 400 });
    }

    // Insert quote lines
    const lineRows = lines.map((l: { label: string; quantity: number; unit_price_ht: number }) => ({
      quote_id: quote.id,
      label: l.label,
      quantity: l.quantity,
      unit_price_ht: l.unit_price_ht,
      total_ht: l.quantity * l.unit_price_ht,
    }));

    const { error: linesError } = await supabase
      .from("quote_lines")
      .insert(lineRows);

    if (linesError) {
      console.error("[api/quotes POST] Lines insert error:", linesError.message);
      // Clean up the quote if lines failed
      await supabase.from("quotes").delete().eq("id", quote.id);
      return NextResponse.json({ error: linesError.message }, { status: 400 });
    }

    // Link to existing planned intervention without a quote
    try {
      const { data: existingIv } = await supabase
        .from("interventions")
        .select("id")
        .eq("client_id", client_id)
        .eq("organization_id", organizationId)
        .is("quote_id", null)
        .eq("status", "planned")
        .order("scheduled_date", { ascending: false })
        .limit(1)
        .single();

      if (existingIv) {
        await supabase
          .from("interventions")
          .update({ quote_id: quote.id })
          .eq("id", existingIv.id);
      }
    } catch { /* no matching intervention — that's fine */ }

    return NextResponse.json({ success: true, quote });
  } catch (err) {
    console.error("[api/quotes POST] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
