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
/*  GET — list follow-ups for a client                                 */
/* ------------------------------------------------------------------ */

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;

    // Verify client belongs to this organization
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("follow_ups")
      .select("*")
      .eq("client_id", params.id)
      .order("performed_at", { ascending: false });

    if (error) {
      console.error("[api/follow-ups GET] Error:", error.message);
      return NextResponse.json({ follow_ups: [] });
    }

    return NextResponse.json({ follow_ups: data ?? [] });
  } catch (err) {
    console.error("[api/follow-ups GET] Unexpected:", err);
    return NextResponse.json({ follow_ups: [] });
  }
}

/* ------------------------------------------------------------------ */
/*  POST — create a follow-up                                          */
/* ------------------------------------------------------------------ */

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, user, organizationId } = auth;

    // Verify client belongs to this organization
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await request.json();

    const row = {
      client_id: params.id,
      organization_id: organizationId,
      action: body.action,
      comment: body.comment || null,
      performed_by: user.id,
      performed_at: body.performed_at || new Date().toISOString(),
      next_contact_date: body.next_contact_date || null,
    };

    console.log("[api/follow-ups POST] Inserting:", JSON.stringify(row));

    const { data, error } = await supabase
      .from("follow_ups")
      .insert([row])
      .select()
      .single();

    if (error) {
      console.error("[api/follow-ups POST] Error:", error.message, error.details, error.hint);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Update next_contact_date on client if provided
    if (body.next_contact_date) {
      await supabase
        .from("clients")
        .update({ next_contact_date: body.next_contact_date })
        .eq("id", params.id);
    }

    return NextResponse.json({ success: true, follow_up: data });
  } catch (err) {
    console.error("[api/follow-ups POST] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
