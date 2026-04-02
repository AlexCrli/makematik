import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const COMPANY_CODES: Record<string, string> = {
  NetVapeur: "NV",
  "Clim Eco Pro": "CEP",
  Clim50: "C50",
};

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
/*  GET — list invoices                                                */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const companyId = searchParams.get("company_id");

    let query = supabase
      .from("invoices")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (status) query = query.in("status", status.split(","));
    if (companyId) query = query.eq("company_id", companyId);

    const { data, error } = await query;

    if (error) {
      console.error("[api/invoices GET] Error:", error.message);
      return NextResponse.json({ invoices: [] });
    }

    // Join client names
    const clientIds = [...new Set((data ?? []).map((i) => i.client_id).filter(Boolean))];
    let clientsMap: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .in("id", clientIds);
      if (clients) {
        clientsMap = Object.fromEntries(clients.map((c) => [c.id, `${c.first_name} ${c.last_name}`]));
      }
    }

    // Join company names
    const companyIds = [...new Set((data ?? []).map((i) => i.company_id).filter(Boolean))];
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

    const invoices = (data ?? []).map((i) => ({
      ...i,
      client_name: clientsMap[i.client_id] ?? null,
      company_name: companiesMap[i.company_id] ?? null,
    }));

    return NextResponse.json({ invoices });
  } catch (err) {
    console.error("[api/invoices GET] Unexpected:", err);
    return NextResponse.json({ invoices: [] });
  }
}

/* ------------------------------------------------------------------ */
/*  POST — create invoice (called at intervention closure)             */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;
    const body = await request.json();

    const {
      company_id, client_id, intervention_id, quote_id,
      payment_method, total_ht, tva_rate = 20,
      tax_credit_applicable = false, tax_credit_rate = 0,
      notes, lines,
    } = body;

    if (!company_id || !client_id || total_ht == null) {
      return NextResponse.json({ error: "company_id, client_id et total_ht requis" }, { status: 400 });
    }

    // Generate invoice number
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", company_id)
      .single();

    const companyCode = COMPANY_CODES[company?.name ?? ""] ?? "XX";
    const now = new Date();
    const year = now.getFullYear();

    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company_id)
      .gte("created_at", `${year}-01-01T00:00:00`)
      .lt("created_at", `${year + 1}-01-01T00:00:00`);

    const invoiceNumber = `FAC-${companyCode}-${year}-${((count ?? 0) + 1).toString().padStart(3, "0")}`;

    const totalTva = total_ht * (tva_rate / 100);
    const totalTtc = total_ht + totalTva;
    const taxCreditAmount = tax_credit_applicable ? totalTtc * (tax_credit_rate / 100) : 0;

    const isDeferred = payment_method === "deferred";
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    let paymentDueDate: string | null = null;
    if (isDeferred) {
      const due = new Date(now);
      due.setDate(due.getDate() + 30);
      paymentDueDate = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`;
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert([{
        organization_id: organizationId,
        company_id,
        client_id,
        intervention_id: intervention_id ?? null,
        quote_id: quote_id ?? null,
        invoice_number: invoiceNumber,
        status: isDeferred ? "pending" : "paid",
        payment_method,
        total_ht,
        tva_rate,
        total_tva: totalTva,
        total_ttc: totalTtc,
        tax_credit_applicable,
        tax_credit_amount: taxCreditAmount,
        payment_due_date: paymentDueDate,
        payment_date: isDeferred ? null : todayStr,
        late_fee_percentage: 20,
        late_fee_applied: false,
        notes: notes ?? null,
      }])
      .select()
      .single();

    if (invoiceError || !invoice) {
      console.error("[api/invoices POST] Insert error:", invoiceError?.message);
      return NextResponse.json({ error: invoiceError?.message ?? "Insert failed" }, { status: 400 });
    }

    // Insert invoice lines
    if (lines && Array.isArray(lines) && lines.length > 0) {
      const lineRows = lines.map((l: { label: string; description?: string; quantity: number; unit_price: number }) => ({
        invoice_id: invoice.id,
        label: l.label,
        description: l.description ?? null,
        quantity: l.quantity,
        unit_price: l.unit_price,
        total_ht: l.quantity * l.unit_price,
      }));

      const { error: linesError } = await supabase
        .from("invoice_lines")
        .insert(lineRows);

      if (linesError) {
        console.error("[api/invoices POST] Lines error:", linesError.message);
      }
    }

    // Update intervention with invoice_id
    if (intervention_id) {
      await supabase
        .from("interventions")
        .update({ invoice_id: invoice.id })
        .eq("id", intervention_id);
    }

    return NextResponse.json({ success: true, invoice });
  } catch (err) {
    console.error("[api/invoices POST] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
