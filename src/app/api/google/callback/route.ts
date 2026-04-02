import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const profileId = searchParams.get("state");
  const error = searchParams.get("error");

  // Utilisateur a refusé l'autorisation
  if (error) {
    return NextResponse.redirect(new URL("/app/planning?google_error=denied", request.url));
  }

  if (!code || !profileId) {
    return NextResponse.redirect(new URL("/app/planning?google_error=missing_params", request.url));
  }

  try {
    // Échanger le code contre les tokens
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
      return NextResponse.redirect(new URL("/app/planning?google_error=token_exchange", request.url));
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Récupérer l'email Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const googleEmail = userInfo.email ?? null;

    // Calculer l'expiration du token
    const expiry = new Date(Date.now() + expires_in * 1000).toISOString();

    // Stocker dans la table profiles
    const supabase = createClient(supabaseUrl, serviceKey);
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
      return NextResponse.redirect(new URL("/app/planning?google_error=save_failed", request.url));
    }

    return NextResponse.redirect(new URL("/app/planning?google_connected=true", request.url));
  } catch (err) {
    console.error("[google/callback] Unexpected:", err);
    return NextResponse.redirect(new URL("/app/planning?google_error=unexpected", request.url));
  }
}
