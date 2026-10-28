import { kvGet, kvSet } from "@/lib/db";
import { haversineKm } from "@/lib/geo";

export type Fix = { lat: number; lng: number; accuracy: number | null; at: number };

export async function saveLastKnown(f: Fix) {
  await kvSet("lastFix", f);
}
export async function getLastKnown(): Promise<Fix | undefined> {
  return kvGet<Fix>("lastFix");
}

/** One-shot GPS fix. GPS works without internet. Falls back to last known position. */
export async function getPosition(timeoutMs = 8000): Promise<{ fix: Fix | null; stale: boolean }> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    const last = await getLastKnown();
    return { fix: last ?? null, stale: true };
  }
  try {
    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 10000,
      }),
    );
    const fix: Fix = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
      at: Date.now(),
    };
    await saveLastKnown(fix);
    return { fix, stale: false };
  } catch {
    const last = await getLastKnown();
    return { fix: last ?? null, stale: true };
  }
}

/**
 * Watch position and emit points at an adaptive rate:
 * every 5 s while moving, every 15 s while still (< 10 m moved).
 */
export function watchAdaptive(onPoint: (f: Fix) => void, onError?: (e: string) => void) {
  if (!navigator.geolocation) {
    onError?.("Location not supported on this device");
    return () => {};
  }
  let latest: Fix | null = null;
  let lastSent: Fix | null = null;
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      latest = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        at: Date.now(),
      };
      void saveLastKnown(latest);
      if (!lastSent) send();
    },
    (err) => onError?.(err.message || "Location unavailable"),
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
  );
  function send() {
    if (!latest) return;
    lastSent = latest;
    onPoint(latest);
  }
  const tick = setInterval(() => {
    if (!latest) return;
    const elapsed = Date.now() - (lastSent?.at ?? 0);
    const moving = lastSent ? haversineKm(lastSent, latest) * 1000 > 10 : true;
    if ((moving && elapsed >= 5000) || elapsed >= 15000) send();
  }, 1000);
  return () => {
    navigator.geolocation.clearWatch(id);
    clearInterval(tick);
  };
}
