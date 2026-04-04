import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";

/**
 * Get a valid Gmail access token for a company, refreshing if expired.
 */
async function getValidGmailToken(companyId: string): Promise<string | null> {
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: company } = await supabase
    .from("companies")
    .select("gmail_access_token, gmail_refresh_token, gmail_token_expiry, gmail_connected")
    .eq("id", companyId)
    .single();

  if (!company?.gmail_connected || !company.gmail_access_token) {
    return null;
  }

  // Token still valid (with 2 min buffer)
  const expiry = new Date(company.gmail_token_expiry).getTime();
  if (expiry > Date.now() + 120_000) {
    return company.gmail_access_token;
  }

  // Refresh
  if (!company.gmail_refresh_token) {
    return null;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: company.gmail_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    console.error("[gmail] Token refresh failed:", data);
    return null;
  }

  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await supabase
    .from("companies")
    .update({ gmail_access_token: data.access_token, gmail_token_expiry: newExpiry })
    .eq("id", companyId);

  return data.access_token;
}

/**
 * Build a MIME message with HTML body and optional PDF attachment
 */
function buildMimeMessage(
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  pdfBuffer?: Buffer,
  pdfFilename?: string,
): string {
  const boundary = "makematik_boundary_" + Date.now();
  const lines: string[] = [];

  lines.push(`From: ${from}`);
  lines.push(`To: ${to}`);
  lines.push(`Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`);
  lines.push("MIME-Version: 1.0");

  if (pdfBuffer && pdfFilename) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/html; charset=UTF-8");
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(Buffer.from(htmlBody).toString("base64"));
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: application/pdf; name="${pdfFilename}"`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push(`Content-Disposition: attachment; filename="${pdfFilename}"`);
    lines.push("");
    lines.push(pdfBuffer.toString("base64"));
    lines.push(`--${boundary}--`);
  } else {
    lines.push("Content-Type: text/html; charset=UTF-8");
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(Buffer.from(htmlBody).toString("base64"));
  }

  return lines.join("\r\n");
}

/**
 * Send an email via Gmail API with optional PDF attachment
 */
export async function sendEmailWithAttachment(
  companyId: string,
  to: string,
  subject: string,
  htmlBody: string,
  pdfBuffer?: Buffer,
  pdfFilename?: string,
): Promise<{ success: boolean; error?: string }> {
  const token = await getValidGmailToken(companyId);
  if (!token) {
    return { success: false, error: "Gmail non connect\u00E9 pour cette soci\u00E9t\u00E9" };
  }

  // Get sender email
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: company } = await supabase
    .from("companies")
    .select("gmail_email, name")
    .eq("id", companyId)
    .single();

  const fromEmail = company?.gmail_email ?? "noreply@makematik.com";
  const fromName = company?.name ?? "Makematik";
  const from = `${fromName} <${fromEmail}>`;

  const mimeMessage = buildMimeMessage(from, to, subject, htmlBody, pdfBuffer, pdfFilename);

  // Gmail API requires URL-safe base64
  const raw = Buffer.from(mimeMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[gmail] Send error:", res.status, errText);
    return { success: false, error: `Erreur Gmail (${res.status})` };
  }

  return { success: true };
}
