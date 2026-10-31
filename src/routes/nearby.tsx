import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Cross, LocateFixed, Navigation, Phone, RefreshCw, Search, Shield } from "lucide-react";
import { toast } from "sonner";
import { getPosition } from "@/services/location";
import { getNearbyPlaces, type NearbyPlace } from "@/lib/nearby.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { MapView } from "@/components/MapView";

export const Route = createFileRoute("/nearby")({
  head: () => ({
    meta: [
      { title: "Nearby police & hospitals — Safe Her" },
      { name: "description", content: "Find the closest police stations and hospitals with call and directions buttons." },
      { property: "og:title", content: "Nearby police & hospitals — Safe Her" },
      { property: "og:description", content: "Closest police stations and hospitals." },
    ],
  }),
  component: Nearby,
});

type Kind = "police" | "hospital" | "both";
const CHIPS = [1, 2, 5, 10, 20] as const;
const LS_KEY = "safeher:nearby:last";
type Saved = { at: number; origin: { lat: number; lng: number }; radiusKm: number; kind: Kind; places: NearbyPlace[] };

const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function Nearby() {
  const [kind, setKind] = useState<Kind>("both");
  const [radius, setRadius] = useState(5);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<NearbyPlace[] | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locDenied, setLocDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [area, setArea] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const first = useRef(true);

  const fetchPlaces = useCallback(
    async (o: { lat: number; lng: number }, k: Kind, r: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await getNearbyPlaces({ data: { lat: o.lat, lng: o.lng, radiusKm: r, type: k } });
        setPlaces(res.places);
        setSavedAt(null);
        try {
          localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), origin: o, radiusKm: r, kind: k, places: res.places } satisfies Saved));
        } catch {
          /* storage full/blocked */
        }
      } catch (e) {
        const saved = readSaved();
        if (saved) {
          setPlaces(saved.places);
          setSavedAt(saved.at);
        } else {
          setPlaces(null);
          setError(e instanceof Error ? e.message : "Could not load nearby places");
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const locate = useCallback(async () => {
    setLoading(true);
    setLocDenied(false);
    const { fix } = await getPosition(10000);
    if (!fix) {
      setLoading(false);
      setLocDenied(true);
      return;
    }
    setOrigin(fix);
    await fetchPlaces(fix, kind, radius);
  }, [fetchPlaces, kind, radius]);

  // Initial location + load
  useEffect(() => {
    void locate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced refresh when type or radius changes
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!origin) return;
    const t = setTimeout(() => void fetchPlaces(origin, kind, radius), 500);
    return () => clearTimeout(t);
  }, [kind, radius, origin, fetchPlaces]);

  const searchArea = async () => {
    const q = area.trim();
    if (!q) return;
    setLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const hits = (await res.json()) as Array<{ lat: string; lon: string }>;
      const hit = hits[0];
      if (!hit) {
        toast.error("Couldn't find that area — try a more specific name");
        setLoading(false);
        return;
      }
      const o = { lat: Number(hit.lat), lng: Number(hit.lon) };
      setLocDenied(false);
      setOrigin(o);
      await fetchPlaces(o, kind, radius);
    } catch {
      setLoading(false);
      toast.error("Area search failed — check your connection");
    }
  };

  const focusCard = (id: string) => {
    document.getElementById(`place-${CSS.escape(id)}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const biggerRadius = () => setRadius((r) => Math.min(25, r + 5));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Nearby help</h1>
          <p className="text-sm text-muted-foreground">We use your location only to find help around you. It never leaves this search.</p>
        </div>
        <Button variant="outline" size="icon" aria-label="Refresh results" title="Refresh" disabled={loading || !origin} onClick={() => origin && void fetchPlaces(origin, kind, radius)}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["police", "hospital", "both"] as const).map((k) => (
          <Button key={k} variant={kind === k ? "default" : "secondary"} className="h-12 rounded-2xl" onClick={() => setKind(k)}>
            {k === "police" ? <Shield className="mr-1 h-4 w-4" /> : k === "hospital" ? <Cross className="mr-1 h-4 w-4" /> : null}
            {k === "both" ? "Both" : k === "police" ? "Police" : "Hospitals"}
          </Button>
        ))}
      </div>

      <div className="space-y-3 rounded-2xl bg-card p-4">
        <div className="flex justify-between text-sm"><span>Search radius</span><span className="font-semibold">{radius} km</span></div>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <Button key={c} size="sm" variant={radius === c ? "default" : "outline"} className="h-9 rounded-full" onClick={() => setRadius(c)}>
              {c} km
            </Button>
          ))}
        </div>
        <Slider min={1} max={25} step={1} value={[radius]} onValueChange={(v) => setRadius(v[0] ?? 5)} />
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" className="h-12 flex-1 rounded-2xl" disabled={loading} onClick={() => void locate()}>
          <LocateFixed className="mr-2 h-4 w-4" /> Use my current location
        </Button>
      </div>

      {locDenied && (
        <div className="space-y-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm font-semibold">We couldn't access your location</p>
          <p className="text-sm text-muted-foreground">
            Location works only on a secure (HTTPS) connection and needs your permission. Allow it in your browser and try again — or search an area instead.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => void locate()}>Try again</Button>
          </div>
          <div className="flex gap-2">
            <Input value={area} onChange={(e) => setArea(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void searchArea()} placeholder="Type an area or address…" className="h-11" />
            <Button className="h-11 rounded-xl" onClick={() => void searchArea()}><Search className="mr-1 h-4 w-4" /> Search</Button>
          </div>
        </div>
      )}

      {savedAt && (
        <p className="rounded-2xl bg-warning/15 px-4 py-2 text-sm font-semibold text-warning">
          Offline: showing results from {new Date(savedAt).toLocaleString()}
        </p>
      )}

      <MapView
        center={origin}
        className="h-64"
        zoom={13}
        radiusKm={radius}
        focusId={focusId}
        onMarkerClick={focusCard}
        markers={(places ?? []).map((p) => ({
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          kind: p.type,
          label: `${p.name} · ${formatKm(p.distanceKm)}`,
        }))}
      />

      {loading && !places ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : error ? (
        <div className="space-y-3 rounded-2xl bg-card p-6 text-center">
          <p>{error}</p>
          <Button onClick={() => origin && void fetchPlaces(origin, kind, radius)}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
        </div>
      ) : places && places.length === 0 ? (
        <div className="space-y-3 rounded-2xl bg-card p-6 text-center">
          <p className="text-muted-foreground">Nothing found within {radius} km.</p>
          {radius < 25 && <Button onClick={biggerRadius}>Search a larger radius</Button>}
        </div>
      ) : (
        <ul className="space-y-3">
          {places?.map((p) => (
            <li key={p.id} id={`place-${p.id}`}>
              <button type="button" onClick={() => setFocusId(p.id)} className="w-full space-y-3 rounded-2xl bg-card p-4 text-left transition-shadow focus:outline-none focus:ring-2 focus:ring-ring">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold">
                      {p.type === "police" ? <Shield className="h-4 w-4 shrink-0 text-[#3b82f6]" /> : <Cross className="h-4 w-4 shrink-0 text-[#ef4444]" />}
                      <span className="truncate">{p.name}</span>
                    </p>
                    <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{p.type === "police" ? "Police" : "Hospital"}</p>
                    {p.address && <p className="mt-1 text-sm text-muted-foreground">{p.address}</p>}
                    {p.phone && <p className="text-sm text-muted-foreground">{p.phone}</p>}
                    {p.openingHours && <p className="text-xs text-muted-foreground">Hours: {p.openingHours}</p>}
                  </div>
                  <span className="shrink-0 font-display font-bold text-primary">{formatKm(p.distanceKm)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {p.phone ? (
                    <Button asChild variant="secondary" className="h-11 rounded-xl" onClick={(e) => e.stopPropagation()}>
                      <a href={`tel:${p.phone}`}><Phone className="mr-2 h-4 w-4" /> Call</a>
                    </Button>
                  ) : (
                    <Button variant="secondary" className="h-11 rounded-xl" disabled>No phone listed</Button>
                  )}
                  <Button asChild className="h-11 rounded-xl" onClick={(e) => e.stopPropagation()}>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">
                      <Navigation className="mr-2 h-4 w-4" /> Directions
                    </a>
                  </Button>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Data © OpenStreetMap contributors — some places may be missing or out of date.</p>
    </div>
  );
}
