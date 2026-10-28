import { supabase } from "@/integrations/supabase/client";
import { queueAdd, queueAll, queueRemove, type QueuedPoint } from "@/lib/db";

/** Push a point now; if offline or failing, keep it in IndexedDB for later. */
export async function pushPoint(p: QueuedPoint) {
  if (!navigator.onLine) return queueAdd(p);
  const { error } = await supabase.from("alert_locations").insert({ alert_id: p.alert_id, lat: p.lat, lng: p.lng, accuracy: p.accuracy, recorded_at: p.recorded_at });
  if (error) await queueAdd(p);
}

let flushing = false;
export async function flushQueue() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const all = await queueAll();
    for (let i = 0; i < all.length; i += 100) {
      const batch = all.slice(i, i + 100);
      const { error } = await supabase
        .from("alert_locations")
        .insert(batch.map(({ id: _id, ...rest }) => rest));
      if (error) {
        // Alert might have ended (RLS rejects); drop points for ended alerts
        if (error.code === "42501") await queueRemove(batch.map((b) => b.id!));
        break;
      }
      await queueRemove(batch.map((b) => b.id!));
    }
  } finally {
    flushing = false;
  }
}

export async function queueSize() {
  return (await queueAll()).length;
}
