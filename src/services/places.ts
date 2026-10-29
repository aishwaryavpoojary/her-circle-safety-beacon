import { cacheGet, cacheSet } from "@/lib/db";
import { haversineKm } from "@/lib/geo";

export type PlaceType = "police" | "hospital" | "clinic";
export type PlaceView = "police" | "hospital" | "both";
export type Place = {
  id: string;
  type: PlaceType;
  name: string;
  lat: number;
  lng: number;
  address: string;
  phone: string | null;
  hours: string | null;
  distanceKm: number;
};
type LatLng = { lat: number; lng: number };
type Cached = { at: number; origin: LatLng; radiusKm: number; places: Place[] };
export type NearbyResult = { places: Place[]; fromCache: boolean; cachedAt?: number };

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
export const RADII = [1, 3, 5, 10, 20] as const;

function query(view: PlaceView, o: LatLng, radiusKm: number) {
  const a = `(around:${Math.round(radiusKm * 1000)},${o.lat},${o.lng})`;
  const parts: string[] = [];
  const add = (f: string) => parts.push(`node${f}${a};way${f}${a};`);
  if (view !== "hospital") add(`["amenity"="police"]`);
  if (view !== "police") {
    add(`["amenity"="hospital"]`);
    add(`["healthcare"="hospital"]`);
    add(`["amenity"="clinic"]`);
  }
  return `[out:json][timeout:25];(${parts.join("")});out center tags 150;`;
}

function typeOf(t: Record<string, string>): PlaceType {
  if (t["amenity"] === "police") return "police";
  if (t["amenity"] === "clinic" && t["healthcare"] !== "hospital") return "clinic";
  return "hospital";
}

export const withDistance = (places: Place[], o: LatLng) =>
  places.map((p) => ({ ...p, distanceKm: haversineKm(o, p) })).sort((a, b) => a.distanceKm - b.distanceKm);

const areaKey = (view: PlaceView, o: LatLng, r: number) => `places:${view}:${o.lat.toFixed(2)}:${o.lng.toFixed(2)}:${r}`;

export async function findNearby(view: PlaceView, origin: LatLng, radiusKm: number): Promise<NearbyResult> {
  const key = areaKey(view, origin, radiusKm);
  const latestKey = `places:${view}:latest`;
  const fromCache = async (): Promise<NearbyResult | null> => {
    const c = (await cacheGet<Cached>(key)) ?? (await cacheGet<Cached>(latestKey));
    return c ? { places: withDistance(c.places, origin), fromCache: true, cachedAt: c.at } : null;
  };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const c = await fromCache();
    if (c) return c;
    throw new Error("You're offline and there are no saved results for this area yet.");
  }
  const q = query(view, origin, radiusKm);
  let lastErr: unknown;
  for (const ep of ENDPOINTS) {
    try {
      const res = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      if (!res.ok) throw new Error(`Map service error ${res.status}`);
      const json = (await res.json()) as { elements: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
      const seen = new Set<string>();
      const places: Place[] = [];
      for (const e of json.elements) {
        const lat = e.lat ?? e.center?.lat;
        const lng = e.lon ?? e.center?.lon;
        const id = `${e.type}/${e.id}`;
        if (lat == null || lng == null || seen.has(id)) continue;
        seen.add(id);
        const t = e.tags ?? {};
        const type = typeOf(t);
        places.push({
          id,
          type,
          name: t["name:en"] || t["name"] || (type === "police" ? "Police station" : type === "clinic" ? "Clinic" : "Hospital"),
          lat,
          lng,
          address: [t["addr:housenumber"], t["addr:street"], t["addr:suburb"], t["addr:city"], t["addr:postcode"]].filter(Boolean).join(", "),
          phone: t["phone"] || t["contact:phone"] || t["emergency:phone"] || null,
          hours: t["opening_hours"] || null,
          distanceKm: 0,
        });
      }
      const sorted = withDistance(places, origin);
      const entry: Cached = { at: Date.now(), origin, radiusKm, places: sorted };
      await Promise.all([cacheSet(key, entry), cacheSet(latestKey, entry)]).catch(() => {});
      return { places: sorted, fromCache: false };
    } catch (e) {
      lastErr = e;
    }
  }
  const c = await fromCache();
  if (c) return c;
  throw lastErr instanceof Error ? lastErr : new Error("Could not load nearby places");
}

/** Nearest police and hospital, trying bigger radii until something is found. */
export async function findNearest(origin: LatLng) {
  for (const r of [5, 10, 20]) {
    try {
      const { places } = await findNearby("both", origin, r);
      const police = places.find((p) => p.type === "police") ?? null;
      const hospital = places.find((p) => p.type !== "police") ?? null;
      if (police || hospital || r === 20) return { police, hospital };
    } catch {
      if (r === 20) break;
    }
  }
  return { police: null, hospital: null };
}

export function directionsUrl(p: LatLng, mode: "driving" | "walking" = "driving") {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=${mode}`;
}
export function geoUrl(p: LatLng & { name: string }) {
  return `geo:${p.lat},${p.lng}?q=${p.lat},${p.lng}(${encodeURIComponent(p.name)})`;
}
export function placeText(p: Place) {
  return [p.name, p.address, p.phone ? `Phone: ${p.phone}` : "", p.hours ? `Hours: ${p.hours}` : "", `https://maps.google.com/?q=${p.lat},${p.lng}`].filter(Boolean).join("\n");
}
export const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
