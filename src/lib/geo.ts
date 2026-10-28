// Pure helpers (covered by tests).

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function mapsLink(lat: number, lng: number) {
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function buildEmergencyMessage(opts: {
  lat?: number;
  lng?: number;
  at: Date;
  ageMinutes?: number;
  trackingUrl?: string;
}) {
  const time = opts.at.toLocaleString();
  let loc: string;
  if (opts.lat == null || opts.lng == null) loc = "Location unavailable";
  else {
    loc = `My location: ${mapsLink(opts.lat, opts.lng)}`;
    if (opts.ageMinutes && opts.ageMinutes >= 1) loc += ` (last known, ${Math.round(opts.ageMinutes)} min old)`;
  }
  const track = opts.trackingUrl ? ` Live: ${opts.trackingUrl}` : "";
  return `EMERGENCY! I need help. ${loc} (${time}).${track} - Safe Her`;
}

/** Build an sms: URI that opens the composer with all numbers and the body pre-filled. */
export function smsUri(numbers: string[], body: string, platform: "ios" | "android") {
  const clean = numbers.map((n) => n.replace(/[^\d+]/g, "")).filter(Boolean);
  const enc = encodeURIComponent(body);
  if (platform === "ios") return `sms:/open?addresses=${clean.join(",")}&body=${enc}`;
  return `sms:${clean.join(",")}?body=${enc}`;
}

export function detectPlatform(): "ios" | "android" {
  if (typeof navigator === "undefined") return "android";
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  return ios ? "ios" : "android";
}

export function randomToken(len = 24) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
}
