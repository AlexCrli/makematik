import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateQuotePdf } from "@/lib/pdf-quote";
import { shouldAdvanceStatus } from "@/lib/client-status";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles").select("organization_id").eq("id", user.id).single();
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 400 });
    }

    const organizationId = profile.organization_id;

    // Fetch quote
    const { data: quote } = await supabase
      .from("quotes").select("*").eq("id", params.id).eq("organization_id", organizationId).single();
    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const { data: lines } = await supabase
      .from("quote_lines").select("*").eq("quote_id", quote.id).order("created_at", { ascending: true });

    const { data: client } = await supabase
      .from("clients").select("first_name, last_name, email, phone, address, postal_code, city, status").eq("id", quote.client_id).single();

    const { data: company } = await supabase
      .from("companies").select("name").eq("id", quote.company_id).single();

    // Generate PDF
    const pdfBuffer = generateQuotePdf({
      quote_number: quote.quote_number,
      created_at: quote.created_at,
      sent_at: quote.sent_at,
      total_ht: quote.total_ht,
      tva_rate: quote.tva_rate ?? 20,
      total_ttc: quote.total_ttc,
      tax_credit_amount: quote.tax_credit_amount ?? 0,
      client: client ?? { first_name: "", last_name: "", email: null, phone: null, address: null, postal_code: null, city: null },
      company,
      lines: (lines ?? []).map((l) => ({ label: l.label, quantity: l.quantity, unit_price_ht: l.unit_price_ht, total_ht: l.total_ht })),
    });

    const pdfBase64 = pdfBuffer.toString("base64");

    // Send via n8n webhook
    let emailSent = false;
    if (client?.email) {
      try {
        const webhookRes = await fetch("https://n8n.makematik.com/webhook/send-quote-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_email: client.email,
            client_name: `${client.first_name} ${client.last_name}`,
            quote_number: quote.quote_number,
            total_ttc: quote.total_ttc,
            pdf_base64: pdfBase64,
            company_name: company?.name ?? "Makematik",
          }),
        });
        emailSent = webhookRes.ok;
        if (!emailSent) {
          console.error("[send-email] Webhook error:", webhookRes.status, await webhookRes.text());
        }
      } catch (webhookErr) {
        console.error("[send-email] Webhook unexpected error:", webhookErr);
      }
    }

    // Mark quote as sent
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const sentAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    await supabase
      .from("quotes")
      .update({ status: "sent", sent_at: sentAt })
      .eq("id", params.id);

    // Update client status (only advance)
    if (client && shouldAdvanceStatus(client.status, "quote_sent")) {
      await supabase
        .from("clients")
        .update({ status: "quote_sent" })
        .eq("id", quote.client_id);
    }

    return NextResponse.json({ success: true, email_sent: emailSent });
  } catch (err) {
    console.error("[api/quotes/[id]/send-email] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
