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

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;

    // Start of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Prospects created this month
    const { count: prospectsThisMonth } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", startOfMonth);

    // Devis en attente (status = quote_sent)
    const { count: devisEnAttente } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "quote_sent");

    // RDV confirmés (status = rdv_confirmed)
    const { count: rdvConfirmes } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "rdv_confirmed");

    // Factures pending
    const { data: pendingInvoices } = await supabase
      .from("invoices")
      .select("id, total_ttc, payment_due_date")
      .eq("organization_id", organizationId)
      .eq("status", "pending");

    const pending = pendingInvoices ?? [];
    const facturesPending = pending.length;
    const facturesPendingAmount = pending.reduce((s, i) => s + (i.total_ttc ?? 0), 0);

    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const facturesOverdue = pending.filter((i) => i.payment_due_date && i.payment_due_date < todayStr).length;

    // CA this month (paid invoices)
    const thisMonthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const { data: paidThisMonth } = await supabase
      .from("invoices")
      .select("total_ttc")
      .eq("organization_id", organizationId)
      .eq("status", "paid")
      .gte("payment_date", thisMonthStart)
      .lte("payment_date", todayStr);

    const caThisMonth = (paidThisMonth ?? []).reduce((s, i) => s + (i.total_ttc ?? 0), 0);

    // CA last month
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthStart = `${lastMonth.getFullYear()}-${pad(lastMonth.getMonth() + 1)}-01`;
    const lastMonthEndStr = `${lastMonthEnd.getFullYear()}-${pad(lastMonthEnd.getMonth() + 1)}-${pad(lastMonthEnd.getDate())}`;

    const { data: paidLastMonth } = await supabase
      .from("invoices")
      .select("total_ttc")
      .eq("organization_id", organizationId)
      .eq("status", "paid")
      .gte("payment_date", lastMonthStart)
      .lte("payment_date", lastMonthEndStr);

    const caLastMonth = (paidLastMonth ?? []).reduce((s, i) => s + (i.total_ttc ?? 0), 0);

    return NextResponse.json({
      prospects_this_month: prospectsThisMonth ?? 0,
      devis_en_attente: devisEnAttente ?? 0,
      rdv_confirmes: rdvConfirmes ?? 0,
      factures_pending: facturesPending,
      factures_pending_amount: facturesPendingAmount,
      factures_overdue: facturesOverdue,
      ca_this_month: caThisMonth,
      ca_last_month: caLastMonth,
    });
  } catch (err) {
    console.error("[api/dashboard/stats] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
