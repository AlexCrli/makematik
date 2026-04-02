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

/* GET — list lines for a quote */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { data, error } = await auth.supabase
      .from("quote_lines")
      .select("*")
      .eq("quote_id", params.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[api/quotes/[id]/lines GET] Error:", error.message);
      return NextResponse.json({ lines: [] });
    }

    return NextResponse.json({ lines: data ?? [] });
  } catch (err) {
    console.error("[api/quotes/[id]/lines GET]", err);
    return NextResponse.json({ lines: [] });
  }
}

/* POST — add a line to a quote */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { label, quantity, unit_price_ht } = body;

    if (!label || quantity == null || unit_price_ht == null) {
      return NextResponse.json({ error: "label, quantity et unit_price_ht requis" }, { status: 400 });
    }

    const total_ht = quantity * unit_price_ht;

    const { data, error } = await auth.supabase
      .from("quote_lines")
      .insert([{
        quote_id: params.id,
        label,
        quantity,
        unit_price_ht,
        total_ht,
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Recalculate quote totals
    await recalculateQuote(auth.supabase, params.id);

    return NextResponse.json({ success: true, line: data });
  } catch (err) {
    console.error("[api/quotes/[id]/lines POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

