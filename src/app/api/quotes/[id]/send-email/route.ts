import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateQuotePdf } from "@/lib/pdf-quote";
import { sendEmailWithAttachment } from "@/lib/gmail";
import { shouldAdvanceStatus } from "@/lib/client-status";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function fmtEur(n: number): string {
  return n.toFixed(2).replace(".", ",") + " \u20AC";
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
      .from("clients").select("first_name, last_name, email, phone, address, postal_code, city, status, civility").eq("id", quote.client_id).single();

    const { data: company } = await supabase
      .from("companies")
      .select("id, name, address, postal_code, city, phone, email, siret, iban, bank_account_name, legal_entity_name, legal_mentions, tva_mention, logo_url, color, gmail_connected, email_subject_quote, email_template_quote")
      .eq("id", quote.company_id)
      .single();

    if (!client?.email) {
      return NextResponse.json({ error: "Le client n'a pas d'adresse email" }, { status: 400 });
    }

    if (!company?.gmail_connected) {
      return NextResponse.json({ error: `Gmail non connect\u00E9 pour ${company?.name ?? "cette soci\u00E9t\u00E9"}. Configurez-le dans Param\u00E8tres.` }, { status: 400 });
    }

    // Generate PDF
    const pdfBuffer = generateQuotePdf({
      quote_number: quote.quote_number,
      created_at: quote.created_at,
      sent_at: quote.sent_at,
      total_ht: quote.total_ht,
      tva_rate: quote.tva_rate ?? 0,
      total_ttc: quote.total_ttc,
      tax_credit_amount: quote.tax_credit_amount ?? 0,
      estimated_duration: quote.estimated_duration ?? null,
      client: client,
      company: company,
      lines: (lines ?? []).map((l) => ({ label: l.label, quantity: l.quantity, unit_price_ht: l.unit_price_ht, total_ht: l.total_ht })),
    });

    // Build email HTML
    const companyName = company.name ?? "Makematik";
    const civility = client.civility ?? "";
    const clientLastName = client.last_name;

    let subject: string;
    let htmlBody: string;

    if (company.email_template_quote) {
      // Custom template from company settings
      subject = company.email_subject_quote ?? `Devis N° ${quote.quote_number} - ${companyName}`;
      const bodyText = company.email_template_quote
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
      subject = `Devis N° ${quote.quote_number} - ${companyName}`;
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background: ${company.color ?? "#6366f1"}; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">${companyName}</h1>
          </div>
          <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Bonjour ${clientName},</p>
            <p>Veuillez trouver ci-joint votre devis <strong>N° ${quote.quote_number}</strong>.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Montant TTC</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${fmtEur(quote.total_ttc)}</td>
              </tr>
              ${quote.tax_credit_amount > 0 ? `
              <tr>
                <td style="padding: 8px 0; color: #059669;">Crédit d'impôt 50%</td>
                <td style="padding: 8px 0; text-align: right; color: #059669;">- ${fmtEur(quote.tax_credit_amount)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Coût réel</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${fmtEur(quote.total_ttc - quote.tax_credit_amount)}</td>
              </tr>` : ""}
            </table>
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
      `${quote.quote_number}.pdf`,
    );

    // Mark quote as sent regardless of email result
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const sentAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    await supabase
      .from("quotes")
      .update({ status: "sent", sent_at: sentAt })
      .eq("id", params.id);

    // Update client status (only advance)
    if (shouldAdvanceStatus(client.status, "quote_sent")) {
      await supabase
        .from("clients")
        .update({ status: "quote_sent" })
        .eq("id", quote.client_id);
    }

    // Record in follow_ups history
    await supabase.from("follow_ups").insert([{
      client_id: quote.client_id,
      organization_id: organizationId,
      action: "email",
      comment: `Devis ${quote.quote_number} envoyé par email`,
      performed_by: user.id,
      performed_at: sentAt,
    }]);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error, quote_marked_sent: true }, { status: 400 });
    }

    return NextResponse.json({ success: true, email_sent: true });
  } catch (err) {
    console.error("[api/quotes/[id]/send-email] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
