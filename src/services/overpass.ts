import { cacheGet, cacheSet } from "@/lib/db";
import { haversineKm } from "@/lib/geo";

export type Place = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  address: string;
  phone: string | null;
  distanceKm: number;
};
export type PlaceKind = "police" | "hospital";

type Cached = { at: number; origin: { lat: number; lng: number }; radiusKm: number; places: Place[] };

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

export async function findNearby(
  kind: PlaceKind,
  origin: { lat: number; lng: number },
  radiusKm: number,
): Promise<{ places: Place[]; fromCache: boolean; cachedAt?: number }> {
  const key = `nearby:${kind}`;
  if (!navigator.onLine) {
    const c = await cacheGet<Cached>(key);
    if (c) return { places: c.places, fromCache: true, cachedAt: c.at };
    throw new Error("You're offline and there are no saved results yet.");
  }
  const r = Math.round(radiusKm * 1000);
  const q = `[out:json][timeout:25];(node["amenity"="${kind}"](around:${r},${origin.lat},${origin.lng});way["amenity"="${kind}"](around:${r},${origin.lat},${origin.lng}););out center tags 100;`;
  let lastErr: unknown;
  for (const ep of ENDPOINTS) {
    try {
      const res = await fetch(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      if (!res.ok) throw new Error(`Map service error ${res.status}`);
      const json = (await res.json()) as { elements: Array<{ id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
      const places: Place[] = json.elements
        .map((e) => {
          const lat = e.lat ?? e.center?.lat;
          const lng = e.lon ?? e.center?.lon;
          if (lat == null || lng == null) return null;
          const t = e.tags ?? {};
          const address = [t["addr:housenumber"], t["addr:street"], t["addr:suburb"], t["addr:city"]].filter(Boolean).join(", ");
          return {
            id: e.id,
            name: t["name"] || t["name:en"] || (kind === "police" ? "Police station" : "Hospital"),
            lat,
            lng,
            address,
            phone: t["phone"] || t["contact:phone"] || null,
            distanceKm: haversineKm(origin, { lat, lng }),
          } as Place;
        })
        .filter((p): p is Place => !!p)
        .sort((a, b) => a.distanceKm - b.distanceKm);
      await cacheSet(key, { at: Date.now(), origin, radiusKm, places } satisfies Cached);
      return { places, fromCache: false };
    } catch (e) {
      lastErr = e;
    }
  }
  const c = await cacheGet<Cached>(key);
  if (c) return { places: c.places, fromCache: true, cachedAt: c.at };
  throw lastErr instanceof Error ? lastErr : new Error("Could not load nearby places");
}
