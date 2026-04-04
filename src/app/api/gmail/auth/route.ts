import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company_id");

  if (!companyId) {
    return NextResponse.json({ error: "company_id requis" }, { status: 400 });
  }

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Google OAuth non configur\u00E9" }, { status: 500 });
  }

  // Verify admin
  const token = request.headers.get("cookie")
    ?.split(";")
    .find((c) => c.trim().startsWith("sb-"))
    ?.split("=")[1];

  // We can't easily check admin from a redirect GET, so we encode
  // the type in state and let the callback verify ownership

  const state = JSON.stringify({ type: "gmail", company_id: companyId });

  const scope = "https://www.googleapis.com/auth/gmail.send";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
