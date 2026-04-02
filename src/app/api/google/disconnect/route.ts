import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
    }

    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
        google_calendar_connected: false,
        google_email: null,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("[google/disconnect] Update error:", updateError.message);
      return NextResponse.json({ error: "Erreur de mise à jour" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[google/disconnect] Unexpected:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
