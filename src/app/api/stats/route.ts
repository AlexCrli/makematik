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
    .from("profiles").select("organization_id").eq("id", user.id).single();
  if (!profile) {
    return { error: NextResponse.json({ error: "Profile not found" }, { status: 400 }) };
  }
  return { supabase, user, organizationId: profile.organization_id as string };
}

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;
    const { searchParams } = new URL(request.url);
    const dateStart = searchParams.get("date_start");
    const dateEnd = searchParams.get("date_end");
    const companyId = searchParams.get("company_id");

    // 1. All invoices for the org
    let invoiceQuery = supabase
      .from("invoices")
      .select("id, company_id, status, payment_method, total_ttc, total_ht, total_tva, payment_date, payment_due_date, late_fee_percentage, late_fee_applied, created_at, invoice_number, client_id")
      .eq("organization_id", organizationId);

    const { data: allInvoices } = await invoiceQuery;
    const invoices = allInvoices ?? [];

    // Filter by period for paid invoices CA
    const periodInvoices = invoices.filter((inv) => {
      if (dateStart && inv.created_at < dateStart) return false;
      if (dateEnd && inv.created_at > dateEnd + "T23:59:59") return false;
      if (companyId && inv.company_id !== companyId) return false;
      return true;
    });

    const paidPeriod = periodInvoices.filter((i) => i.status === "paid");
    const totalCa = paidPeriod.reduce((s, i) => s + (i.total_ttc ?? 0), 0);

    // 2. Interventions count
    let ivQuery = supabase
      .from("interventions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "completed");

    if (dateStart) ivQuery = ivQuery.gte("scheduled_date", dateStart);
    if (dateEnd) ivQuery = ivQuery.lte("scheduled_date", dateEnd);
    if (companyId) ivQuery = ivQuery.eq("company_id", companyId);
    const { count: totalInterventions } = await ivQuery;

    // 3. Pending invoices (not filtered by period)
    const allPending = invoices.filter((i) => i.status === "pending");
    const pendingFiltered = companyId ? allPending.filter((i) => i.company_id === companyId) : allPending;
    const pendingCount = pendingFiltered.length;
    const pendingAmount = pendingFiltered.reduce((s, i) => s + (i.total_ttc ?? 0), 0);

    // 4. CA par mois (for the year or period)
    const caParMois: Record<string, Record<string, number>> = {};
    for (const inv of paidPeriod) {
      const month = (inv.payment_date ?? inv.created_at).slice(0, 7); // YYYY-MM
      if (!caParMois[month]) caParMois[month] = {};
      const cid = inv.company_id ?? "other";
      caParMois[month][cid] = (caParMois[month][cid] ?? 0) + (inv.total_ttc ?? 0);
    }

    // Get company names
    const companyIds = [...new Set(invoices.map((i) => i.company_id).filter(Boolean))];
    let companiesMap: Record<string, string> = {};
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies").select("id, name").in("id", companyIds);
      if (companies) companiesMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
    }

    const caParMoisArr = Object.entries(caParMois)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, byCompany]) => ({ month, ...byCompany }));

    // 5. Répartition par mode de paiement
    const repartition: Record<string, { amount: number; count: number }> = {};
    for (const inv of periodInvoices.filter((i) => i.status === "paid" || i.status === "pending")) {
      const method = inv.payment_method ?? "other";
      if (!repartition[method]) repartition[method] = { amount: 0, count: 0 };
      repartition[method].amount += inv.total_ttc ?? 0;
      repartition[method].count += 1;
    }

    const repartitionArr = Object.entries(repartition).map(([method, data]) => ({
      method, ...data,
    }));

    // 6. Factures différées pending (ALL, not filtered by period)
    const differeePending = invoices
      .filter((i) => i.status === "pending" && i.payment_method === "deferred")
      .sort((a, b) => (a.payment_due_date ?? "").localeCompare(b.payment_due_date ?? ""));

    // Enrich with client names
    const clientIds = [...new Set(differeePending.map((i) => i.client_id))];
    let clientsMap: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from("clients").select("id, first_name, last_name").in("id", clientIds);
      if (clients) clientsMap = Object.fromEntries(clients.map((c) => [c.id, `${c.first_name} ${c.last_name}`]));
    }

    const factureDiffereePending = differeePending.map((i) => ({
      ...i,
      client_name: clientsMap[i.client_id] ?? null,
      company_name: companiesMap[i.company_id] ?? null,
    }));

    // 7. Factures différées réglées
    const differeeReglees = invoices
      .filter((i) => i.status === "paid" && i.late_fee_applied !== null)
      .filter((i) => {
        // Was originally deferred — heuristic: has payment_due_date set
        return i.payment_due_date != null;
      })
      .sort((a, b) => (b.payment_date ?? "").localeCompare(a.payment_date ?? ""));

    const clientIds2 = [...new Set(differeeReglees.map((i) => i.client_id).filter((id) => !clientsMap[id]))];
    if (clientIds2.length > 0) {
      const { data: clients } = await supabase
        .from("clients").select("id, first_name, last_name").in("id", clientIds2);
      if (clients) {
        for (const c of clients) clientsMap[c.id] = `${c.first_name} ${c.last_name}`;
      }
    }

    const factureDiffereeReglees = differeeReglees.map((i) => ({
      ...i,
      client_name: clientsMap[i.client_id] ?? null,
      company_name: companiesMap[i.company_id] ?? null,
    }));

    return NextResponse.json({
      total_ca: totalCa,
      total_interventions: totalInterventions ?? 0,
      pending_count: pendingCount,
      pending_amount: pendingAmount,
      ca_par_mois: caParMoisArr,
      companies_map: companiesMap,
      repartition_paiement: repartitionArr,
      factures_differees: factureDiffereePending,
      factures_differees_reglees: factureDiffereeReglees,
    });
  } catch (err) {
    console.error("[api/stats GET] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
