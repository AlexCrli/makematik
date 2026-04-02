import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateInvoicePdf } from "@/lib/pdf-invoice";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function GET(
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

    const { data: invoice } = await supabase
      .from("invoices").select("*").eq("id", params.id).eq("organization_id", profile.organization_id).single();
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { data: lines } = await supabase
      .from("invoice_lines").select("*").eq("invoice_id", invoice.id).order("created_at", { ascending: true });

    const { data: client } = await supabase
      .from("clients").select("first_name, last_name, email, phone, address, postal_code, city").eq("id", invoice.client_id).single();

    const { data: company } = await supabase
      .from("companies").select("name").eq("id", invoice.company_id).single();

    const pdfBuffer = generateInvoicePdf({
      invoice_number: invoice.invoice_number,
      created_at: invoice.created_at,
      status: invoice.status,
      payment_method: invoice.payment_method,
      payment_date: invoice.payment_date,
      payment_due_date: invoice.payment_due_date,
      late_fee_percentage: invoice.late_fee_percentage ?? 20,
      total_ht: invoice.total_ht,
      tva_rate: invoice.tva_rate ?? 20,
      total_tva: invoice.total_tva,
      total_ttc: invoice.total_ttc,
      tax_credit_applicable: invoice.tax_credit_applicable ?? false,
      tax_credit_amount: invoice.tax_credit_amount ?? 0,
      client: client ?? { first_name: "", last_name: "", email: null, phone: null, address: null, postal_code: null, city: null },
      company,
      lines: (lines ?? []).map((l) => ({ label: l.label, quantity: l.quantity, unit_price: l.unit_price, total_ht: l.total_ht })),
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[api/invoices/[id]/pdf] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
