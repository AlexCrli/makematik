import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recalculateQuote } from "@/lib/quote-recalculate";

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
  return { supabase, user };
}

/* PUT — update a quote line */
export async function PUT(
  request: Request,
  { params }: { params: { id: string; lineId: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if ("label" in body) updates.label = body.label;
    if ("quantity" in body) updates.quantity = body.quantity;
    if ("unit_price_ht" in body) updates.unit_price_ht = body.unit_price_ht;

    if (body.quantity != null && body.unit_price_ht != null) {
      updates.total_ht = body.quantity * body.unit_price_ht;
    } else if (body.quantity != null) {
      const { data: existing } = await auth.supabase
        .from("quote_lines").select("unit_price_ht").eq("id", params.lineId).single();
      if (existing) updates.total_ht = body.quantity * existing.unit_price_ht;
    } else if (body.unit_price_ht != null) {
      const { data: existing } = await auth.supabase
        .from("quote_lines").select("quantity").eq("id", params.lineId).single();
      if (existing) updates.total_ht = existing.quantity * body.unit_price_ht;
    }

    const { data, error } = await auth.supabase
      .from("quote_lines")
      .update(updates)
      .eq("id", params.lineId)
      .eq("quote_id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await recalculateQuote(auth.supabase, params.id);

    return NextResponse.json({ success: true, line: data });
  } catch (err) {
    console.error("[api/quotes/[id]/lines/[lineId] PUT]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/* DELETE — remove a quote line */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; lineId: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { error } = await auth.supabase
      .from("quote_lines")
      .delete()
      .eq("id", params.lineId)
      .eq("quote_id", params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await recalculateQuote(auth.supabase, params.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/quotes/[id]/lines/[lineId] DELETE]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
