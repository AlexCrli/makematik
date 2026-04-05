import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateInvoicePdf } from "@/lib/pdf-invoice";
import { sendEmailWithAttachment } from "@/lib/gmail";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function fmtEur(n: number): string {
  return n.toFixed(2).replace(".", ",") + " \u20AC";
}

function fmtDate(dateStr: string): string {
  const d = dateStr.slice(0, 10);
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

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

    // Fetch invoice
    const { data: invoice } = await supabase
      .from("invoices").select("*").eq("id", params.id).eq("organization_id", profile.organization_id).single();
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { data: lines } = await supabase
      .from("invoice_lines").select("*").eq("invoice_id", invoice.id).order("created_at", { ascending: true });

    const { data: client } = await supabase
      .from("clients").select("first_name, last_name, email, phone, address, postal_code, city, civility").eq("id", invoice.client_id).single();

    const { data: company } = await supabase
      .from("companies")
      .select("id, name, address, postal_code, city, phone, email, siret, iban, bank_account_name, legal_entity_name, legal_mentions, tva_mention, logo_url, color, gmail_connected, email_subject_invoice, email_template_invoice")
      .eq("id", invoice.company_id)
      .single();

    if (!client?.email) {
      return NextResponse.json({ error: "Le client n'a pas d'adresse email" }, { status: 400 });
    }

    if (!company?.gmail_connected) {
      return NextResponse.json({ error: `Gmail non connect\u00E9 pour ${company?.name ?? "cette soci\u00E9t\u00E9"}. Configurez-le dans Param\u00E8tres.` }, { status: 400 });
    }

    // Fetch quote number if linked
    let quoteNumber: string | null = null;
    if (invoice.quote_id) {
      const { data: quote } = await supabase
        .from("quotes").select("quote_number").eq("id", invoice.quote_id).single();
      if (quote) quoteNumber = quote.quote_number;
    }

    // Generate PDF
    const pdfBuffer = generateInvoicePdf({
      invoice_number: invoice.invoice_number,
      created_at: invoice.created_at,
      status: invoice.status,
      payment_method: invoice.payment_method,
      payment_date: invoice.payment_date,
      payment_due_date: invoice.payment_due_date,
      late_fee_percentage: invoice.late_fee_percentage ?? 20,
      late_fee_applied: invoice.late_fee_applied ?? false,
      total_ht: invoice.total_ht,
      tva_rate: invoice.tva_rate ?? 0,
      total_tva: invoice.total_tva,
      total_ttc: invoice.total_ttc,
      tax_credit_applicable: invoice.tax_credit_applicable ?? false,
      tax_credit_amount: invoice.tax_credit_amount ?? 0,
      quote_number: quoteNumber,
      client: client,
      company: company,
      lines: (lines ?? []).map((l) => ({ label: l.label, quantity: l.quantity, unit_price: l.unit_price, total_ht: l.total_ht })),
    });

    // Build email HTML
    const companyName = company.name ?? "Makematik";
    const civility = client.civility ?? "";
    const clientLastName = client.last_name;

    let subject: string;
    let htmlBody: string;

    if (company.email_template_invoice) {
      // Custom template from company settings
      subject = company.email_subject_invoice ?? `Facture N° ${invoice.invoice_number} - ${companyName}`;
      const bodyText = company.email_template_invoice
        .replace(/\[civilite\]/g, civility)
        .replace(/\[nom\]/g, clientLastName);
      const bodyHtml = bodyText.replace(/\n/g, "<br>");
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: ${company.color ?? "#6366f1"}; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">${companyName}</h1>
          </div>
          <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="white-space: pre-line;">${bodyHtml}</p>
          </div>
        </div>
      `;
    } else {
      // Default generic template
      const clientName = `${client.first_name} ${client.last_name}`;
      subject = `Facture N° ${invoice.invoice_number} - ${companyName}`;

      let statusLine = "";
      if (invoice.status === "paid") {
        statusLine = `<p style="color: #059669; font-weight: bold;">Cette facture est réglée. Merci !</p>`;
      } else if (invoice.payment_due_date) {
        statusLine = `<p>Échéance de paiement : <strong>${fmtDate(invoice.payment_due_date)}</strong></p>`;
      }

      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: ${company.color ?? "#6366f1"}; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">${companyName}</h1>
          </div>
          <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Bonjour ${clientName},</p>
            <p>Veuillez trouver ci-joint votre facture <strong>N° ${invoice.invoice_number}</strong>.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Montant TTC</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${fmtEur(invoice.total_ttc)}</td>
              </tr>
            </table>
            ${statusLine}
            <p>N'hésitez pas à nous contacter pour toute question.</p>
            <p style="margin-top: 24px;">Cordialement,<br/><strong>${companyName}</strong></p>
            ${company.phone ? `<p style="color: #6b7280; font-size: 13px;">${company.phone}</p>` : ""}
          </div>
        </div>
      `;
    }

    // Send via Gmail
    const result = await sendEmailWithAttachment(
      company.id,
      client.email,
      subject,
      htmlBody,
      pdfBuffer,
      `${invoice.invoice_number}.pdf`,
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, email_sent: true });
  } catch (err) {
    console.error("[api/invoices/[id]/send-email] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
