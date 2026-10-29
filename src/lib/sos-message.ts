// Shared SOS text, used by the server sender and the offline SMS composer.
export function buildSosSms(o: {
  name: string;
  lat?: number | null;
  lng?: number | null;
  trackingUrl?: string | null;
  nearestPolice?: string | null | undefined;
  at: Date;
  ageMinutes?: number;
}) {
  const loc =
    o.lat != null && o.lng != null
      ? `https://maps.google.com/?q=${o.lat.toFixed(6)},${o.lng.toFixed(6)}${o.ageMinutes && o.ageMinutes >= 1 ? ` (last known, ${Math.round(o.ageMinutes)} min old)` : ""}`
      : "unavailable";
  const track = o.trackingUrl ? ` Live tracking: ${o.trackingUrl}` : "";
  const police = o.nearestPolice ? ` Nearest police: ${o.nearestPolice}.` : "";
  return `EMERGENCY from ${o.name}! She needs help. Location: ${loc}${track}${police} Time: ${o.at.toLocaleString()}. - Safe Her`;
}
