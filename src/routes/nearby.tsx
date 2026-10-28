import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Navigation, Phone, RefreshCw, Shield, Cross } from "lucide-react";
import { useApp } from "@/lib/app-state";
import { getPosition } from "@/services/location";
import { findNearby, type Place, type PlaceKind } from "@/services/overpass";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { MapView } from "@/components/MapView";
import { detectPlatform } from "@/lib/geo";

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

function Nearby() {
  const { online } = useApp();
  const [kind, setKind] = useState<PlaceKind>("police");
  const [radius, setRadius] = useState(5);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { fix } = await getPosition(8000);
      if (!fix) throw new Error("Couldn't get your location. Allow location access and try again.");
      setOrigin(fix);
      const r = await findNearby(kind, fix, radius);
      setPlaces(r.places);
      setCachedAt(r.fromCache ? r.cachedAt ?? Date.now() : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [kind, radius]);

  useEffect(() => {
    void load();
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const directions = (p: Place) => {
    const g = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
    const w = window.open(g, "_blank");
    if (!w) window.location.href = detectPlatform() === "ios" ? `maps://?daddr=${p.lat},${p.lng}` : `geo:${p.lat},${p.lng}?q=${p.lat},${p.lng}(${encodeURIComponent(p.name)})`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nearby help</h1>
      <div className="grid grid-cols-2 gap-2">
        <Button variant={kind === "police" ? "default" : "secondary"} className="h-12 rounded-2xl" onClick={() => setKind("police")}><Shield className="mr-2 h-4 w-4" /> Police</Button>
        <Button variant={kind === "hospital" ? "default" : "secondary"} className="h-12 rounded-2xl" onClick={() => setKind("hospital")}><Cross className="mr-2 h-4 w-4" /> Hospitals</Button>
      </div>
      <div className="space-y-2 rounded-2xl bg-card p-4">
        <div className="flex justify-between text-sm"><span>Search radius</span><span className="font-semibold">{radius} km</span></div>
        <Slider min={1} max={20} step={1} value={[radius]} onValueChange={(v) => setRadius(v[0] ?? 5)} onValueCommit={() => void load()} />
      </div>
      {cachedAt && <p className="rounded-2xl bg-warning/15 px-4 py-2 text-sm font-semibold text-warning">Showing saved results from {new Date(cachedAt).toLocaleString()}{online ? "" : " (offline)"}</p>}
      <MapView center={origin} className="h-56" zoom={13} markers={(places ?? []).slice(0, 40).map((p) => ({ lat: p.lat, lng: p.lng, kind: "place" as const, label: p.name }))} />
      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : error ? (
        <div className="space-y-3 rounded-2xl bg-card p-6 text-center">
          <p>{error}</p>
          <Button onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" /> Try again</Button>
        </div>
      ) : places && places.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center text-muted-foreground">Nothing found within {radius} km. Try a bigger radius.</p>
      ) : (
        <ul className="space-y-3">
          {places?.map((p) => (
            <li key={p.id} className="space-y-3 rounded-2xl bg-card p-4">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{p.name}</p>
                  {p.address && <p className="text-sm text-muted-foreground">{p.address}</p>}
                  {p.phone && <p className="text-sm text-muted-foreground">{p.phone}</p>}
                </div>
                <span className="shrink-0 font-display font-bold text-primary">{p.distanceKm < 1 ? `${Math.round(p.distanceKm * 1000)} m` : `${p.distanceKm.toFixed(1)} km`}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {p.phone ? (
                  <Button asChild variant="secondary" className="h-11 rounded-xl"><a href={`tel:${p.phone}`}><Phone className="mr-2 h-4 w-4" /> Call</a></Button>
                ) : (
                  <Button variant="secondary" className="h-11 rounded-xl" disabled>No phone listed</Button>
                )}
                <Button className="h-11 rounded-xl" onClick={() => directions(p)}><Navigation className="mr-2 h-4 w-4" /> Directions</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Data from OpenStreetMap — some places may be missing or out of date.</p>
    </div>
  );
}
