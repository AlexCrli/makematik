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
/*  GET — single intervention with full details                        */
/* ------------------------------------------------------------------ */

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;

    const { data, error } = await supabase
      .from("interventions")
      .select("*")
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Intervention not found" }, { status: 404 });
    }

    // Client info
    let client = null;
    if (data.client_id) {
      const { data: c, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", data.client_id)
        .single();

      if (clientError) {
        console.error("[api/interventions/[id] GET] Client fetch error:", clientError.message);
      }

      if (c) {
        let company_name: string | null = null;
        if (c.company_id) {
          const { data: co } = await supabase
            .from("companies")
            .select("name")
            .eq("id", c.company_id)
            .single();
          if (co) company_name = co.name;
        }
        client = { ...c, company_name };
      }
    }

    // Assignee name (legacy)
    let assignee_name: string | null = null;
    if (data.assigned_to) {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.assigned_to)
        .single();
      if (p) assignee_name = p.full_name;
    }

    // Assignees from junction table
    let assignees: { profile_id: string; full_name: string; color: string | null }[] = [];
    {
      const { data: assigneeRows } = await supabase
        .from("intervention_assignees")
        .select("profile_id")
        .eq("intervention_id", data.id);

      if (assigneeRows && assigneeRows.length > 0) {
        const profileIds = assigneeRows.map((a) => a.profile_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, color")
          .in("id", profileIds);
        if (profiles) {
          assignees = profiles.map((p) => ({ profile_id: p.id, full_name: p.full_name, color: p.color }));
        }
      }
    }

    // Quote info
    let quote = null;
    if (data.quote_id) {
      const { data: q } = await supabase
        .from("quotes")
        .select("id, quote_number, total_ht, tva_rate, total_ttc, tax_credit_amount")
        .eq("id", data.quote_id)
        .single();
      if (q) quote = q;
    }

    return NextResponse.json({
      intervention: {
        ...data,
        client,
        assignee_name,
        assignees,
        quote,
      },
    });
  } catch (err) {
    console.error("[api/interventions/[id] GET] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  PUT — update an intervention                                       */
/* ------------------------------------------------------------------ */

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;
    const body = await request.json();

    const { data: existing } = await supabase
      .from("interventions")
      .select("id")
      .eq("id", params.id)
      .eq("organization_id", organizationId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Intervention not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const allowed = [
      "assigned_to", "scheduled_date", "scheduled_time",
      "duration_minutes", "status", "field_notes",
      "payment_method", "payment_amount", "completed_at",
    ];
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("interventions")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("[api/interventions/[id] PUT] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, intervention: data });
  } catch (err) {
    console.error("[api/interventions/[id] PUT] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE — delete an intervention                                    */
/* ------------------------------------------------------------------ */

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;

    const { error } = await supabase
      .from("interventions")
      .delete()
      .eq("id", params.id)
      .eq("organization_id", organizationId);

    if (error) {
      console.error("[api/interventions/[id] DELETE] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/interventions/[id] DELETE] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
