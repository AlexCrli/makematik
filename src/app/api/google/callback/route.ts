import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "";

// Base URL d\u00E9duite de GOOGLE_REDIRECT_URI (ex: https://makematik.com)
const baseUrl = redirectUri ? new URL(redirectUri).origin : "https://makematik.com";

function appRedirect(path: string) {
  return NextResponse.redirect(`${baseUrl}${path}`);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const error = searchParams.get("error");

  // Parse state: could be a plain profileId (calendar) or JSON with type
  let stateType = "calendar";
  let profileId: string | null = null;
  let companyId: string | null = null;

  if (stateRaw) {
    try {
      const parsed = JSON.parse(stateRaw);
      if (parsed.type === "gmail") {
        stateType = "gmail";
        companyId = parsed.company_id;
      } else {
        profileId = stateRaw;
      }
    } catch {
      // Not JSON — plain profileId for calendar
      profileId = stateRaw;
    }
  }

  // User denied authorization
  if (error) {
    if (stateType === "gmail") {
      return appRedirect(`/app/settings/${companyId ?? ""}?gmail_error=denied`);
    }
    return appRedirect("/app/planning?google_error=denied");
  }

  if (!code) {
    if (stateType === "gmail") {
      return appRedirect(`/app/settings/${companyId ?? ""}?gmail_error=missing_params`);
    }
    return appRedirect("/app/planning?google_error=missing_params");
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[google/callback] Token exchange error:", tokenData);
      if (stateType === "gmail") {
        return appRedirect(`/app/settings/${companyId ?? ""}?gmail_error=token_exchange`);
      }
      return appRedirect("/app/planning?google_error=token_exchange");
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Get Google email
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const googleEmail = userInfo.email ?? null;

    // Calculate token expiry
    const expiry = new Date(Date.now() + expires_in * 1000).toISOString();

    const supabase = createClient(supabaseUrl, serviceKey);

    if (stateType === "gmail" && companyId) {
      // ── Gmail flow: save tokens to companies table ──
      const { error: updateError } = await supabase
        .from("companies")
        .update({
          gmail_access_token: access_token,
          gmail_refresh_token: refresh_token,
          gmail_token_expiry: expiry,
          gmail_connected: true,
          gmail_email: googleEmail,
        })
        .eq("id", companyId);

      if (updateError) {
        console.error("[google/callback] Company gmail update error:", updateError.message);
        return appRedirect(`/app/settings/${companyId}?gmail_error=save_failed`);
      }

      return appRedirect(`/app/settings/${companyId}?gmail_connected=true`);
    } else {
      // ── Calendar flow: save tokens to profiles table ──
      if (!profileId) {
        return appRedirect("/app/planning?google_error=missing_params");
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          google_access_token: access_token,
          google_refresh_token: refresh_token,
          google_token_expiry: expiry,
          google_calendar_connected: true,
          google_email: googleEmail,
        })
        .eq("id", profileId);

      if (updateError) {
        console.error("[google/callback] Profile update error:", updateError.message);
        return appRedirect("/app/planning?google_error=save_failed");
      }

      return appRedirect("/app/planning?google_connected=true");
    }
  } catch (err) {
    console.error("[google/callback] Unexpected:", err);
    if (stateType === "gmail") {
      return appRedirect(`/app/settings/${companyId ?? ""}?gmail_error=unexpected`);
    }
    return appRedirect("/app/planning?google_error=unexpected");
  }
}
