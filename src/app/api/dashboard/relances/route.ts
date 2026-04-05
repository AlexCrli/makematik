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

function daysBetween(dateStr: string, today: string): number {
  const d1 = new Date(dateStr);
  const d2 = new Date(today);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // Fetch companies with followup settings (single query, no N+1)
    const { data: companiesData } = await supabase
      .from("companies")
      .select("id, name, followup_quote_days, followup_invoice_days")
      .eq("organization_id", organizationId);

    const companiesMap: Record<string, { name: string; followup_quote_days: number; followup_invoice_days: number }> = {};
    for (const c of companiesData ?? []) {
      companiesMap[c.id] = {
        name: c.name,
        followup_quote_days: c.followup_quote_days ?? 7,
        followup_invoice_days: c.followup_invoice_days ?? 30,
      };
    }

    // 1. Status "new" — all new prospects
    const { data: newProspects } = await supabase
      .from("clients")
      .select("id, first_name, last_name, phone, city, status, next_contact_date, company_id, email")
      .eq("organization_id", organizationId)
      .eq("status", "new")
      .order("created_at", { ascending: false });

    // 2. Status "to_recall" with next_contact_date <= today or NULL
    const { data: toRecallDue } = await supabase
      .from("clients")
      .select("id, first_name, last_name, phone, city, status, next_contact_date, company_id, email")
      .eq("organization_id", organizationId)
      .eq("status", "to_recall")
      .or(`next_contact_date.lte.${today},next_contact_date.is.null`)
      .order("next_contact_date", { ascending: true });

    // 3. Status "quote_sent" — need to check last quote sent_at vs followup_quote_days
    const { data: quoteSentClients } = await supabase
      .from("clients")
      .select("id, first_name, last_name, phone, city, status, next_contact_date, company_id, email")
      .eq("organization_id", organizationId)
      .eq("status", "quote_sent");

    // Batch fetch latest sent quote per quote_sent client
    const quoteSentIds = (quoteSentClients ?? []).map((c) => c.id);
    let quoteSentRelances: typeof quoteSentClients & { relance_reason?: string; relance_days?: number }[] = [];

    if (quoteSentIds.length > 0) {
      const { data: sentQuotes } = await supabase
        .from("quotes")
        .select("client_id, sent_at")
        .in("client_id", quoteSentIds)
        .eq("status", "sent")
        .order("sent_at", { ascending: false });

      // Group: latest sent_at per client
      const latestSentAt: Record<string, string> = {};
      for (const q of sentQuotes ?? []) {
        if (!latestSentAt[q.client_id] && q.sent_at) {
          latestSentAt[q.client_id] = q.sent_at;
        }
      }

      quoteSentRelances = (quoteSentClients ?? []).filter((c) => {
        const sentAt = latestSentAt[c.id];
        if (!sentAt) return true; // no sent_at, show anyway
        const companyConfig = c.company_id ? companiesMap[c.company_id] : null;
        const thresholdDays = companyConfig?.followup_quote_days ?? 7;
        return daysBetween(sentAt, today) >= thresholdDays;
      }).map((c) => {
        const sentAt = latestSentAt[c.id];
        const days = sentAt ? daysBetween(sentAt, today) : 0;
        return { ...c, relance_days: days };
      });
    }

    // 4. Status "client" with pending invoices overdue
    const { data: pendingInvoices } = await supabase
      .from("invoices")
      .select("id, client_id, payment_due_date, created_at")
      .eq("organization_id", organizationId)
      .eq("status", "pending");

    // Group pending invoices by client_id, find the most overdue
    const invoiceClients: Record<string, { days: number }> = {};
    for (const inv of pendingInvoices ?? []) {
      const clientCompanyId = (quoteSentClients ?? []).find((c) => c.id === inv.client_id)?.company_id;
      // We need to also check clients with status "client"
      const companyConfig = clientCompanyId ? companiesMap[clientCompanyId] : null;
      const thresholdDays = companyConfig?.followup_invoice_days ?? 30;

      let overdueDays = 0;
      if (inv.payment_due_date && inv.payment_due_date <= today) {
        overdueDays = daysBetween(inv.payment_due_date, today);
      } else if (!inv.payment_due_date) {
        // No due date: check if invoice is old enough based on created_at
        overdueDays = daysBetween(inv.created_at, today);
        if (overdueDays < thresholdDays) continue;
      } else {
        continue; // not due yet
      }

      if (!invoiceClients[inv.client_id] || overdueDays > invoiceClients[inv.client_id].days) {
        invoiceClients[inv.client_id] = { days: overdueDays };
      }
    }

    const invoiceClientIds = Object.keys(invoiceClients);
    let invoiceRelances: Array<{
      id: string; first_name: string; last_name: string; phone: string | null;
      city: string | null; status: string; next_contact_date: string | null;
      company_id: string | null; email: string | null; relance_days: number;
    }> = [];

    if (invoiceClientIds.length > 0) {
      const { data: clientsWithInvoice } = await supabase
        .from("clients")
        .select("id, first_name, last_name, phone, city, status, next_contact_date, company_id, email")
        .eq("organization_id", organizationId)
        .eq("status", "client")
        .in("id", invoiceClientIds);

      invoiceRelances = (clientsWithInvoice ?? []).map((c) => ({
        ...c,
        relance_days: invoiceClients[c.id]?.days ?? 0,
      }));
    }

    // Merge and deduplicate, assign relance_reason
    const seen = new Set<string>();
    const all: Array<{
      id: string; first_name: string; last_name: string; phone: string | null;
      city: string | null; status: string; next_contact_date: string | null;
      company_id: string | null; email: string | null; company_name: string;
      relance_reason: string; relance_days: number;
    }> = [];

    function addClient(
      c: { id: string; first_name: string; last_name: string; phone: string | null; city: string | null; status: string; next_contact_date: string | null; company_id: string | null; email: string | null },
      reason: string,
      days: number,
    ) {
      if (seen.has(c.id)) return;
      seen.add(c.id);
      all.push({
        ...c,
        company_name: c.company_id ? (companiesMap[c.company_id]?.name ?? "—") : "—",
        relance_reason: reason,
        relance_days: days,
      });
    }

    // Priority order: invoices first, then quote_sent, then to_recall, then new
    for (const c of invoiceRelances) {
      addClient(c, "invoice", c.relance_days);
    }
    for (const c of quoteSentRelances ?? []) {
      addClient(c, "quote", (c as { relance_days?: number }).relance_days ?? 0);
    }
    for (const c of toRecallDue ?? []) {
      addClient(c, "to_recall", 0);
    }
    for (const c of newProspects ?? []) {
      if (!seen.has(c.id)) {
        addClient(c, "new", 0);
      }
    }

    return NextResponse.json({ relances: all });
  } catch (err) {
    console.error("[api/dashboard/relances] Unexpected:", err);
    return NextResponse.json({ relances: [] });
  }
}
