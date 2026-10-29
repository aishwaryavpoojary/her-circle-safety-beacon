import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSosSms } from "@/lib/sos-message";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const Input = z.object({
  alertId: z.string().uuid(),
  type: z.enum(["sos", "trip", "allclear"]),
  appUrl: z.string().url().max(300),
  contactIds: z.array(z.string().uuid()).max(5).optional(),
  nearestPolice: z.string().max(160).optional(),
});

export type Delivery = { contactId: string; name: string; status: "sending" | "sent" | "failed"; error?: string };
export type SendResult = {
  test: boolean;
  setupMissing: boolean;
  body: string;
  deliveries: Delivery[];
  sent: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * "send-sos-sms": texts trusted contacts through Twilio, in parallel,
 * retrying each failed message up to 3 times with backoff, and records
 * each contact's status in notification_deliveries.
 */
export const sendSosSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<SendResult> => {
    const { supabase } = context;
    const { data: alert, error: aErr } = await supabase.from("alerts").select("*").eq("id", data.alertId).maybeSingle();
    if (aErr || !alert) throw new Error("Alert not found");

    let q = supabase.from("contacts").select("*").order("priority");
    if (data.contactIds?.length) q = q.in("id", data.contactIds);
    const { data: contacts, error: cErr } = await q;
    if (cErr) throw new Error(cErr.message);
    if (!contacts?.length) throw new Error("No trusted contacts saved");

    const name = alert.sender_name || "Your contact";
    const track = `${new URL(data.appUrl).origin}/track/${alert.tracking_token}`;
    let body: string;
    if (data.type === "sos")
      body = buildSosSms({
        name,
        lat: alert.start_lat,
        lng: alert.start_lng,
        trackingUrl: track,
        nearestPolice: data.nearestPolice,
        at: new Date(alert.started_at),
      });
    else if (data.type === "trip") body = `${name} is sharing their trip with you via Safe Her. Follow live: ${track}`;
    else body = `${name} is safe now. The alert has ended. - Safe Her`;

    if (alert.is_test) {
      return {
        test: true,
        setupMissing: false,
        body,
        sent: 0,
        deliveries: contacts.map((c) => ({ contactId: c.id, name: c.name, status: "sent" as const })),
      };
    }

    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    const TWILIO_API_KEY = process.env["TWILIO_API_KEY"];
    const FROM = process.env["TWILIO_FROM_NUMBER"];
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !FROM) {
      console.error("SMS setup missing: connect Twilio and add TWILIO_FROM_NUMBER");
      return { test: false, setupMissing: true, body, sent: 0, deliveries: [] };
    }

    const kind = data.type;
    await supabase.from("notification_deliveries").upsert(
      contacts.map((c) => ({ alert_id: alert.id, contact_id: c.id, contact_name: c.name, kind, status: "sending", error: null, attempts: 0 })),
      { onConflict: "alert_id,contact_id,kind" },
    );

    const deliveries = await Promise.all(
      contacts.map(async (c): Promise<Delivery> => {
        let lastErr = "";
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
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
              lastErr = `SMS failed [${res.status}]: ${t.slice(0, 200)}`;
              // 4xx other than rate limits won't succeed on retry
              if (res.status >= 400 && res.status < 500 && res.status !== 429) {
                await record(c.id, "failed", lastErr, attempt);
                return { contactId: c.id, name: c.name, status: "failed", error: lastErr };
              }
            } else {
              await record(c.id, "sent", null, attempt);
              return { contactId: c.id, name: c.name, status: "sent" };
            }
          } catch (e) {
            lastErr = e instanceof Error ? e.message : "Network error";
          }
          if (attempt < 3) await sleep(500 * 2 ** (attempt - 1));
        }
        await record(c.id, "failed", lastErr, 3);
        return { contactId: c.id, name: c.name, status: "failed", error: lastErr };
      }),
    );

    async function record(contactId: string, status: string, error: string | null, attempts: number) {
      await supabase
        .from("notification_deliveries")
        .update({ status, error, attempts, sent_at: status === "sent" ? new Date().toISOString() : null })
        .eq("alert_id", alert!.id)
        .eq("contact_id", contactId)
        .eq("kind", kind);
    }

    return { test: false, setupMissing: false, body, deliveries, sent: deliveries.filter((d) => d.status === "sent").length };
  });
