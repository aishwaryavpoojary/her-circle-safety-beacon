import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { haversineKm } from "@/lib/geo";

export type NearbyPlace = {
  id: string;
  type: "police" | "hospital";
  name: string;
  address: string;
  phone: string | null;
  openingHours: string | null;
  lat: number;
  lng: number;
  distanceKm: number;
};
export type NearbyResponse = { places: NearbyPlace[]; cachedAt: number };

const Input = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().min(1).max(25),
  type: z.enum(["police", "hospital", "both"]),
});

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_RESULTS = 50;
const USER_AGENT = "SafeHer/1.0 (women's safety app; https://her-circle-safety-beacon.lovable.app)";

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function buildQuery(type: "police" | "hospital" | "both", lat: number, lng: number, radiusKm: number) {
  const around = `(around:${Math.round(radiusKm * 1000)},${lat},${lng})`;
  const kinds = type === "both" ? (["police", "hospital"] as const) : ([type] as const);
  const parts = kinds.map(
    (k) => `node["amenity"="${k}"]${around};way["amenity"="${k}"]${around};relation["amenity"="${k}"]${around};`,
  );
  return `[out:json][timeout:25];(${parts.join("")});out center tags 200;`;
}

/** Query Overpass with a 20 s timeout, one retry per endpoint, then the backup server. */
async function queryOverpass(q: string): Promise<OverpassElement[]> {
  let lastErr: unknown;
  for (const ep of ENDPOINTS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        const res = await fetch(ep, {
          method: "POST",
          body: "data=" + encodeURIComponent(q),
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`Map service error ${res.status}`);
        const json = (await res.json()) as { elements?: OverpassElement[] };
        return json.elements ?? [];
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Map service unavailable");
}

function normalize(elements: OverpassElement[], origin: { lat: number; lng: number }): NearbyPlace[] {
  const seen = new Set<string>();
  const places: NearbyPlace[] = [];
  for (const e of elements) {
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    const id = `${e.type}/${e.id}`;
    if (lat == null || lng == null || seen.has(id)) continue;
    seen.add(id);
    const t = e.tags ?? {};
    const type = t["amenity"] === "police" ? "police" : "hospital";
    places.push({
      id,
      type,
      name: t["name:en"] || t["name"] || (type === "police" ? "Unnamed police station" : "Unnamed hospital"),
      address: [t["addr:housenumber"], t["addr:street"], t["addr:suburb"], t["addr:city"], t["addr:postcode"]]
        .filter(Boolean)
        .join(", "),
      phone: t["phone"] || t["contact:phone"] || null,
      openingHours: t["opening_hours"] || null,
      lat,
      lng,
      distanceKm: haversineKm(origin, { lat, lng }),
    });
  }
  return places.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, MAX_RESULTS);
}

/**
 * "nearby-places": server-side Overpass proxy (no browser CORS issues, proper
 * User-Agent) with a 6-hour per-tile cache in the places_cache table.
 * Public endpoint — it only ever returns public OpenStreetMap data.
 */
export const getNearbyPlaces = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<NearbyResponse> => {
    const origin = { lat: data.lat, lng: data.lng };
    const key = `${data.type}:${data.lat.toFixed(2)}:${data.lng.toFixed(2)}:${data.radiusKm}`;

    const pubKey = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, pubKey, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (pubKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${pubKey}`) h.delete("Authorization");
          h.set("apikey", pubKey);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: cached } = await supabase.from("places_cache").select("payload, fetched_at").eq("key", key).maybeSingle();
    if (cached) {
      const at = new Date(cached.fetched_at).getTime();
      if (Date.now() - at < CACHE_TTL_MS) {
        const places = (cached.payload as { places: NearbyPlace[] }).places.map((p) => ({
          ...p,
          distanceKm: haversineKm(origin, p),
        }));
        places.sort((a, b) => a.distanceKm - b.distanceKm);
        return { places, cachedAt: at };
      }
    }

    const elements = await queryOverpass(buildQuery(data.type, data.lat, data.lng, data.radiusKm));
    const places = normalize(elements, origin);
    const now = Date.now();
    await supabase
      .from("places_cache")
      .upsert({ key, payload: { places }, fetched_at: new Date(now).toISOString() })
      .then(() => {});
    return { places, cachedAt: now };
  });
