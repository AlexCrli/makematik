import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Map client fields to Supabase column names
    const row = {
      name: body.name,
      email: body.email,
      phone: body.phone || null,
      company: body.company,
      sector: body.sector || null,
      needs: Array.isArray(body.needs) ? body.needs : [],
      description: body.description,
      specific_features: body.features || null,
      budget: body.budget || null,
      status: "new",
    };

    // Save to Supabase
    if (supabase) {
      const { error } = await supabase.from("prospects").insert([row]);
      if (error) {
        console.error("Supabase insert error:", error.message);
      }
    } else {
      console.warn("Supabase not configured — skipping insert");
    }

    // Notify via n8n webhook
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (err) {
        console.error("n8n webhook error:", err);
      }
    } else {
      console.warn("N8N_WEBHOOK_URL not configured — skipping notification");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Prospect API error:", err);
    return NextResponse.json({ success: true });
  }
}
