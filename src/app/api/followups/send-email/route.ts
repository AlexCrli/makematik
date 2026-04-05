import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmailWithAttachment } from "@/lib/gmail";
import { generateQuotePdf } from "@/lib/pdf-quote";
import { generateInvoicePdf } from "@/lib/pdf-invoice";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function fmtEur(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

function fmtDateFr(dateStr: string): string {
  const d = dateStr.slice(0, 10);
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export async function POST(request: Request) {
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
    const body = await request.json();
    const { client_id, followup_type, quote_id, invoice_id } = body;

    if (!client_id || !followup_type) {
      return NextResponse.json({ error: "client_id et followup_type requis" }, { status: 400 });
    }

    // Fetch client
    const { data: client } = await supabase
      .from("clients")
      .select("id, first_name, last_name, email, phone, address, postal_code, city, civility, company_id, status")
      .eq("id", client_id)
      .eq("organization_id", organizationId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }
    if (!client.email) {
      return NextResponse.json({ error: "Le client n'a pas d'adresse email" }, { status: 400 });
    }
    if (!client.company_id) {
      return NextResponse.json({ error: "Le client n'est rattaché à aucune société" }, { status: 400 });
    }

    // Fetch company with all template fields
    const { data: company } = await supabase
      .from("companies")
      .select("*")
      .eq("id", client.company_id)
      .single();

    if (!company) {
      return NextResponse.json({ error: "Société introuvable" }, { status: 404 });
    }
    if (!company.gmail_connected) {
      return NextResponse.json({ error: `Gmail non connecté pour ${company.name}` }, { status: 400 });
    }

    const civility = client.civility ?? "";
    const clientLastName = client.last_name;
    const companyName = company.name ?? "Makematik";
    const companyColor = company.color ?? "#6366f1";

    let subject: string;
    let templateBody: string;
    let pdfBuffer: Buffer | undefined;
    let pdfFilename: string | undefined;
    let commentMsg: string;

    if (followup_type === "prospect") {
      // Relance prospection
      if (!company.email_template_followup_prospect) {
        return NextResponse.json({ error: "Aucun template de relance prospection configuré pour cette société" }, { status: 400 });
      }
      subject = company.email_subject_followup_prospect ?? `Relance - ${companyName}`;
      templateBody = company.email_template_followup_prospect;
      commentMsg = "Email de relance prospection envoyé";

    } else if (followup_type === "quote") {
      // Relance devis — find the quote
      if (!company.email_template_followup_quote) {
        return NextResponse.json({ error: "Aucun template de relance devis configuré pour cette société" }, { status: 400 });
      }

      let quoteQuery = supabase
        .from("quotes")
        .select("*, quote_lines:quote_lines(*)")
        .eq("client_id", client_id)
        .eq("organization_id", organizationId);

      if (quote_id) {
        quoteQuery = quoteQuery.eq("id", quote_id);
      } else {
        quoteQuery = quoteQuery.eq("status", "sent").order("created_at", { ascending: false }).limit(1);
      }

      const { data: quotes } = await quoteQuery;
      const quote = quotes?.[0];
      if (!quote) {
        return NextResponse.json({ error: "Aucun devis envoyé trouvé pour ce prospect" }, { status: 404 });
      }

      subject = company.email_subject_followup_quote ?? `Relance devis - ${companyName}`;
      templateBody = company.email_template_followup_quote;
      commentMsg = `Email de relance devis envoyé avec devis ${quote.quote_number} en PJ`;

      // Generate quote PDF
      const lines = (quote.quote_lines ?? []).map((l: { label: string; quantity: number; unit_price_ht: number; total_ht: number }) => ({
        label: l.label, quantity: l.quantity, unit_price_ht: l.unit_price_ht, total_ht: l.total_ht,
      }));
      pdfBuffer = generateQuotePdf({
        quote_number: quote.quote_number,
        created_at: quote.created_at,
        sent_at: quote.sent_at,
        total_ht: quote.total_ht,
        tva_rate: quote.tva_rate ?? 0,
        total_ttc: quote.total_ttc,
        tax_credit_amount: quote.tax_credit_amount ?? 0,
        estimated_duration: quote.estimated_duration ?? null,
        client,
        company,
        lines,
      });
      pdfFilename = `${quote.quote_number}.pdf`;

    } else if (followup_type === "invoice") {
      // Relance facture
      if (!company.email_template_followup_invoice) {
        return NextResponse.json({ error: "Aucun template de relance facture configuré pour cette société" }, { status: 400 });
      }

      let invoiceQuery = supabase
        .from("invoices")
        .select("*, invoice_lines:invoice_lines(*)")
        .eq("client_id", client_id)
        .eq("organization_id", organizationId);

      if (invoice_id) {
        invoiceQuery = invoiceQuery.eq("id", invoice_id);
      } else {
        invoiceQuery = invoiceQuery.eq("status", "pending").order("created_at", { ascending: true }).limit(1);
      }

      const { data: invoices } = await invoiceQuery;
      const invoice = invoices?.[0];
      if (!invoice) {
        return NextResponse.json({ error: "Aucune facture impayée trouvée pour ce client" }, { status: 404 });
      }

      // Fetch linked quote number if exists
      let quoteNumber: string | null = null;
      if (invoice.quote_id) {
        const { data: q } = await supabase.from("quotes").select("quote_number").eq("id", invoice.quote_id).single();
        if (q) quoteNumber = q.quote_number;
      }

      subject = company.email_subject_followup_invoice ?? `Rappel de paiement - ${companyName}`;
      templateBody = company.email_template_followup_invoice
        .replace(/\[numero_facture\]/g, invoice.invoice_number ?? "")
        .replace(/\[montant_ttc\]/g, fmtEur(invoice.total_ttc ?? 0))
        .replace(/\[date_echeance\]/g, invoice.payment_due_date ? fmtDateFr(invoice.payment_due_date) : "non définie")
        .replace(/\[titulaire_compte\]/g, company.bank_account_name ?? "")
        .replace(/\[iban\]/g, company.iban ?? "");

      commentMsg = `Email de relance facture ${invoice.invoice_number} envoyé`;

      // Generate invoice PDF
      const lines = (invoice.invoice_lines ?? []).map((l: { label: string; quantity: number; unit_price: number; total_ht: number }) => ({
        label: l.label, quantity: l.quantity, unit_price: l.unit_price, total_ht: l.total_ht,
      }));
      pdfBuffer = generateInvoicePdf({
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
        client,
        company,
        lines,
      });
      pdfFilename = `${invoice.invoice_number}.pdf`;

    } else {
      return NextResponse.json({ error: "followup_type invalide (prospect, quote, invoice)" }, { status: 400 });
    }

    // Replace common placeholders
    const bodyText = templateBody
      .replace(/\[civilite\]/g, civility)
      .replace(/\[nom\]/g, clientLastName);

    // Convert to HTML
    const bodyHtml = bodyText.replace(/\n/g, "<br>");
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: ${companyColor}; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">${companyName}</h1>
        </div>
        <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="white-space: pre-line;">${bodyHtml}</p>
        </div>
      </div>
    `;

    // Send email
    const result = await sendEmailWithAttachment(
      company.id,
      client.email,
      subject,
      htmlBody,
      pdfBuffer,
      pdfFilename,
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: commentMsg });
  } catch (err) {
    console.error("[api/followups/send-email] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
