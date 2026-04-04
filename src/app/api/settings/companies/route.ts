import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function GET(request: Request) {
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
      .from("profiles").select("organization_id, role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("companies")
      .select("id, name, code, color, logo_url, gmail_connected, gmail_email")
      .eq("organization_id", profile.organization_id)
      .order("name");

    if (error) {
      return NextResponse.json({ companies: [] });
    }
    return NextResponse.json({ companies: data ?? [] });
  } catch (err) {
    console.error("[api/settings/companies GET] Unexpected:", err);
    return NextResponse.json({ companies: [] });
  }
}
