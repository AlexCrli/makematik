import { NextResponse } from "next/server";

const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profile_id");

  if (!profileId) {
    return NextResponse.json({ error: "profile_id requis" }, { status: 400 });
  }

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Google OAuth non configuré" }, { status: 500 });
  }

  const scope = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    state: profileId,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
