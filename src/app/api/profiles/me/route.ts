import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function PUT(request: Request) {
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

    const body = await request.json();
    const { share_personal_calendar } = body;

    if (typeof share_personal_calendar !== "boolean") {
      return NextResponse.json({ error: "share_personal_calendar doit être un booléen" }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ share_personal_calendar })
      .eq("id", user.id);

    if (error) {
      console.error("[api/profiles/me PUT] Error:", error.message);
      return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
    }

    return NextResponse.json({ success: true, share_personal_calendar });
  } catch (err) {
    console.error("[api/profiles/me PUT] Unexpected:", err);
    return NextResponse.json({ error: "Erreur inattendue" }, { status: 500 });
  }
}
