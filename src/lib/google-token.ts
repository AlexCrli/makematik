import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";

/**
 * Récupère un access_token valide pour un profil donné.
 * Rafraîchit automatiquement si expiré.
 * Retourne null si le profil n'a pas de connexion Google.
 */
export async function getValidGoogleToken(profileId: string): Promise<string | null> {
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: profile } = await supabase
    .from("profiles")
    .select("google_access_token, google_refresh_token, google_token_expiry, google_calendar_connected")
    .eq("id", profileId)
    .single();

  if (!profile?.google_calendar_connected || !profile.google_access_token) {
    return null;
  }

  // Token encore valide (avec 2 min de marge)
  const expiry = new Date(profile.google_token_expiry).getTime();
  if (expiry > Date.now() + 120_000) {
    return profile.google_access_token;
  }

  // Rafraîchir le token
  if (!profile.google_refresh_token) {
    return null;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: profile.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    console.error("[google-token] Refresh failed:", data);
    return null;
  }

  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

  await supabase
    .from("profiles")
    .update({
      google_access_token: data.access_token,
      google_token_expiry: newExpiry,
    })
    .eq("id", profileId);

  return data.access_token;
}
