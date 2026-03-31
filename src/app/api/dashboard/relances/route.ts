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

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const { supabase, organizationId } = auth;

    const today = new Date().toISOString().split("T")[0];

    // Prospects to follow up: status "new" OR next_contact_date <= today
    const { data: newProspects } = await supabase
      .from("clients")
      .select("id, first_name, last_name, phone, city, status, next_contact_date, company_id")
      .eq("organization_id", organizationId)
      .eq("status", "new")
      .order("created_at", { ascending: false });

    const { data: overdueProspects } = await supabase
      .from("clients")
      .select("id, first_name, last_name, phone, city, status, next_contact_date, company_id")
      .eq("organization_id", organizationId)
      .lte("next_contact_date", today)
      .order("next_contact_date", { ascending: true });

    // Merge and deduplicate
    const seen = new Set<string>();
    const all = [];
    for (const list of [overdueProspects ?? [], newProspects ?? []]) {
      for (const p of list) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          all.push(p);
        }
      }
    }

    // Fetch company names
    const companyIds = [...new Set(all.map((p) => p.company_id).filter(Boolean))];
    let companiesMap: Record<string, string> = {};
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds);
      if (companies) {
        companiesMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
      }
    }

    const relances = all.map((p) => ({
      ...p,
      company_name: p.company_id ? (companiesMap[p.company_id] ?? "—") : "—",
    }));

    return NextResponse.json({ relances });
  } catch (err) {
    console.error("[api/dashboard/relances] Unexpected:", err);
    return NextResponse.json({ relances: [] });
  }
}
