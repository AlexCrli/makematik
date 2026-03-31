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

/* ------------------------------------------------------------------ */
/*  POST — mark quote as sent + update prospect status                 */
/* ------------------------------------------------------------------ */

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;

    // Fetch quote
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id, client_id")
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Mark quote as sent
    const { error: updateError } = await supabase
      .from("quotes")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", params.id);

    if (updateError) {
      console.error("[api/quotes/[id]/send POST] Update error:", updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Update prospect status to quote_sent
    await supabase
      .from("clients")
      .update({ status: "quote_sent" })
      .eq("id", quote.client_id)
      .eq("organization_id", organizationId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/quotes/[id]/send POST] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
