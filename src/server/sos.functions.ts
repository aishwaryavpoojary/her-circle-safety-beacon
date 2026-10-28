import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const Input = z.object({
  alertId: z.string().uuid(),
  type: z.enum(["sos", "trip", "allclear"]),
  appUrl: z.string().url().max(300),
  contactIds: z.array(z.string().uuid()).max(5).optional(),
});

/**
 * "send-sos-sms": sends SMS to the user's trusted contacts via Twilio.
 * Keys come from server secrets only (TWILIO_API_KEY via connector, TWILIO_FROM_NUMBER).
 */
export const sendSosSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: alert, error: aErr } = await supabase
      .from("alerts")
      .select("*")
      .eq("id", data.alertId)
      .maybeSingle();
    if (aErr || !alert) throw new Error("Alert not found");

    let q = supabase.from("contacts").select("*").order("priority");
    if (data.contactIds?.length) q = q.in("id", data.contactIds);
    const { data: contacts, error: cErr } = await q;
    if (cErr) throw new Error(cErr.message);
    if (!contacts?.length) throw new Error("No trusted contacts saved");

    const name = alert.sender_name || "Your contact";
    const time = new Date(alert.started_at).toUTCString();
    const track = `${new URL(data.appUrl).origin}/track/${alert.tracking_token}`;
    const maps =
      alert.start_lat != null ? `https://maps.google.com/?q=${alert.start_lat},${alert.start_lng}` : "location pending";
    let body: string;
    if (data.type === "sos")
      body = `EMERGENCY! ${name} needs help (${time}). Location: ${maps} Live tracking: ${track} - Safe Her`;
    else if (data.type === "trip")
      body = `${name} is sharing their trip with you via Safe Her. Follow live: ${track}`;
    else body = `${name} is safe now. The alert has ended. - Safe Her`;

    if (alert.is_test) {
      return { sent: 0, test: true, recipients: contacts.map((c) => c.name), body };
    }

    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    const TWILIO_API_KEY = process.env["TWILIO_API_KEY"];
    const FROM = process.env["TWILIO_FROM_NUMBER"];
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !FROM) {
      throw new Error("SMS service is not set up yet");
    }

    const results = await Promise.allSettled(
      contacts.map(async (c) => {
        const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: c.phone.replace(/[^\d+]/g, ""), From: FROM, Body: body }),
        });
        if (!res.ok) {
          const t = await res.text();
          console.error(`Twilio send failed [${res.status}]: ${t}`);
          throw new Error(`SMS failed [${res.status}]`);
        }
        return c.name;
      }),
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;
    if (sent === 0) throw new Error("Could not send any SMS");
    return { sent, test: false, recipients: contacts.map((c) => c.name), body };
  });
