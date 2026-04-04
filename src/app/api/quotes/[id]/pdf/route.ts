import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateQuotePdf } from "@/lib/pdf-quote";

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

    // Fetch quote with all data
    const { data: quote } = await supabase
      .from("quotes").select("*").eq("id", params.id).eq("organization_id", profile.organization_id).single();
    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const { data: lines } = await supabase
      .from("quote_lines").select("*").eq("quote_id", quote.id).order("created_at", { ascending: true });

    const { data: client } = await supabase
      .from("clients").select("first_name, last_name, email, phone, address, postal_code, city").eq("id", quote.client_id).single();

    const { data: company } = await supabase
      .from("companies")
      .select("name, address, postal_code, city, phone, email, siret, iban, bank_account_name, legal_entity_name, legal_mentions, tva_mention, logo_url, color")
      .eq("id", quote.company_id)
      .single();

    const pdfBuffer = generateQuotePdf({
      quote_number: quote.quote_number,
      created_at: quote.created_at,
      sent_at: quote.sent_at,
      total_ht: quote.total_ht,
      tva_rate: quote.tva_rate ?? 0,
      total_ttc: quote.total_ttc,
      tax_credit_amount: quote.tax_credit_amount ?? 0,
      estimated_duration: quote.estimated_duration ?? null,
      client: client ?? { first_name: "", last_name: "", email: null, phone: null, address: null, postal_code: null, city: null },
      company: company ?? { name: "Makematik" },
      lines: (lines ?? []).map((l) => ({ label: l.label, quantity: l.quantity, unit_price_ht: l.unit_price_ht, total_ht: l.total_ht })),
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quote.quote_number}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[api/quotes/[id]/pdf] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
