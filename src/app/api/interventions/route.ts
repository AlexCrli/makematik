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
/*  GET — list interventions with client info                          */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const assignedTo = searchParams.get("assigned_to");

    let query = supabase
      .from("interventions")
      .select("*")
      .eq("organization_id", organizationId)
      .order("scheduled_date")
      .order("scheduled_time");

    if (startDate) query = query.gte("scheduled_date", startDate);
    if (endDate) query = query.lte("scheduled_date", endDate);
    if (assignedTo) query = query.eq("assigned_to", assignedTo);

    const { data, error } = await query;

    if (error) {
      console.error("[api/interventions GET] Error:", error.message);
      return NextResponse.json({ interventions: [] });
    }

    // Join client info
    const clientIds = [...new Set((data ?? []).map((i) => i.client_id).filter(Boolean))];
    let clientsMap: Record<string, { first_name: string; last_name: string; address: string | null; city: string | null; postal_code: string | null; phone: string | null; nb_splits: number | null; company_id: string | null }> = {};
    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, first_name, last_name, address, city, postal_code, phone, nb_splits, company_id")
        .in("id", clientIds);
      if (clients) {
        clientsMap = Object.fromEntries(clients.map((c) => [c.id, c]));
      }
    }

    // Join assignee names
    const assigneeIds = [...new Set((data ?? []).map((i) => i.assigned_to).filter(Boolean))];
    let assigneesMap: Record<string, string> = {};
    if (assigneeIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", assigneeIds);
      if (profiles) {
        assigneesMap = Object.fromEntries(profiles.map((p) => [p.id, p.full_name]));
      }
    }

    const interventions = (data ?? []).map((i) => ({
      ...i,
      client: clientsMap[i.client_id] ?? null,
      assignee_name: assigneesMap[i.assigned_to] ?? null,
    }));

    return NextResponse.json({ interventions });
  } catch (err) {
    console.error("[api/interventions GET] Unexpected:", err);
    return NextResponse.json({ interventions: [] });
  }
}

/* ------------------------------------------------------------------ */
/*  POST — create an intervention                                      */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;
    const body = await request.json();

    const row = {
      organization_id: organizationId,
      client_id: body.client_id,
      company_id: body.company_id || null,
      quote_id: body.quote_id || null,
      assigned_to: body.assigned_to,
      scheduled_date: body.scheduled_date,
      scheduled_time: body.scheduled_time,
      duration_minutes: body.duration_minutes ?? 60,
      status: "planned",
      field_notes: body.field_notes || null,
    };

    const { data, error } = await supabase
      .from("interventions")
      .insert([row])
      .select()
      .single();

    if (error) {
      console.error("[api/interventions POST] Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Update prospect status to rdv_confirmed
    if (body.client_id) {
      const { error: statusError } = await supabase
        .from("clients")
        .update({ status: "rdv_confirmed" })
        .eq("id", body.client_id);

      if (statusError) {
        console.error("[api/interventions POST] Client status update error:", statusError.message);
      }
    }

    // Create follow_up entry for history
    let assigneeName = "un intervenant";
    try {
      if (body.assigned_to) {
        const { data: assignee } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", body.assigned_to)
          .single();
        if (assignee?.full_name) assigneeName = assignee.full_name;
      }

      const rdvDate = body.scheduled_date ?? "";
      const rdvTime = body.scheduled_time ? body.scheduled_time.slice(0, 5) : "";
      const comment = `RDV planifié le ${rdvDate} à ${rdvTime} avec ${assigneeName}`;

      const { error: followUpError } = await supabase
        .from("follow_ups")
        .insert([{
          client_id: body.client_id,
          organization_id: organizationId,
          action: "call",
          comment,
          performed_by: auth.user.id,
          performed_at: new Date().toISOString(),
        }]);

      if (followUpError) {
        console.error("[api/interventions POST] Follow-up insert error:", followUpError.message);
      }
    } catch (fuErr) {
      console.error("[api/interventions POST] Follow-up unexpected error:", fuErr);
    }

    // Webhook n8n → Google Calendar
    try {
      const { data: clientInfo } = await supabase
        .from("clients")
        .select("first_name, last_name, phone, address, postal_code, city, nb_splits")
        .eq("id", body.client_id)
        .single();

      let companyName = "";
      if (body.company_id) {
        const { data: company } = await supabase
          .from("companies")
          .select("name")
          .eq("id", body.company_id)
          .single();
        if (company?.name) companyName = company.name;
      }

      // Build start/end datetimes in Europe/Paris (UTC+02:00)
      const tz = "+02:00";
      const offsetMs = 2 * 60 * 60 * 1000;
      const startDatetime = `${body.scheduled_date}T${body.scheduled_time}${tz}`;
      const durationMs = (body.duration_minutes ?? 60) * 60 * 1000;
      const endUtc = new Date(new Date(startDatetime).getTime() + durationMs);
      // Shift to local Paris time before extracting components
      const endLocal = new Date(endUtc.getTime() + offsetMs);
      const pad = (n: number) => String(n).padStart(2, "0");
      const endDatetime =
        `${endLocal.getUTCFullYear()}-${pad(endLocal.getUTCMonth() + 1)}-${pad(endLocal.getUTCDate())}` +
        `T${pad(endLocal.getUTCHours())}:${pad(endLocal.getUTCMinutes())}:${pad(endLocal.getUTCSeconds())}${tz}`;

      const webhookBody = {
        client_name: clientInfo ? `${clientInfo.first_name} ${clientInfo.last_name}` : "",
        phone: clientInfo?.phone ?? "",
        address: clientInfo?.address ?? "",
        postal_code: clientInfo?.postal_code ?? "",
        city: clientInfo?.city ?? "",
        nb_splits: clientInfo?.nb_splits ?? null,
        company_name: companyName,
        assigned_to_name: assigneeName,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        notes: body.field_notes ?? "",
        intervention_id: data.id,
      };

      const webhookRes = await fetch("https://n8n.makematik.com/webhook/intervention-created", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookBody),
      });

      if (!webhookRes.ok) {
        console.error("[api/interventions POST] Webhook n8n error:", webhookRes.status, await webhookRes.text());
      }
    } catch (webhookErr) {
      console.error("[api/interventions POST] Webhook n8n unexpected error:", webhookErr);
    }

    return NextResponse.json({ success: true, intervention: data });
  } catch (err) {
    console.error("[api/interventions POST] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
