import { useEffect, useRef, useState } from "react";
import { Cross, Navigation, Phone, Shield } from "lucide-react";
import { haversineKm } from "@/lib/geo";
import { getNearbyPlaces, type NearbyPlace } from "@/lib/nearby.functions";
import { Button } from "@/components/ui/button";

const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

function HelpCard({ p }: { p: NearbyPlace }) {
  const police = p.type === "police";
  const Icon = police ? Shield : Cross;
  return (
    <article className="space-y-2 rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${police ? "text-[#3b82f6]" : "text-[#ef4444]"}`} />
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold">{p.name}</h3>
          <p className="text-xs text-muted-foreground">{police ? "Police" : "Hospital"} · {formatKm(p.distanceKm)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {p.phone ? (
          <Button asChild variant="secondary" size="sm" className="h-10 rounded-xl">
            <a href={`tel:${p.phone}`}><Phone className="mr-1 h-4 w-4" /> Call</a>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" className="h-10 rounded-xl" disabled>No phone</Button>
        )}
        <Button asChild size="sm" className="h-10 rounded-xl">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">
            <Navigation className="mr-1 h-4 w-4" /> Directions
          </a>
        </Button>
      </div>
    </article>
  );
}

/**
 * The 3 nearest police stations and 3 nearest hospitals around `origin`,
 * refreshed whenever the location moves about 500 m. Used on the SOS
 * active screen and the public tracking page.
 */
export function NearbyHelp({ origin }: { origin: { lat: number; lng: number } | null }) {
  const previous = useRef<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!origin || (previous.current && haversineKm(previous.current, origin) < 0.5)) return;
    let cancelled = false;
    previous.current = origin;
    setLoading(true);
    setFailed(false);
    getNearbyPlaces({ data: { lat: origin.lat, lng: origin.lng, radiusKm: 10, type: "both" } })
      .then((r) => {
        if (cancelled) return;
        const police = r.places.filter((p) => p.type === "police").slice(0, 3);
        const hospitals = r.places.filter((p) => p.type === "hospital").slice(0, 3);
        setPlaces([...police, ...hospitals]);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [origin?.lat, origin?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Nearest help</h2>
      {!origin ? (
        <p className="text-sm text-muted-foreground">Waiting for location…</p>
      ) : loading && !places.length ? (
        <p className="text-sm text-muted-foreground">Finding nearby help…</p>
      ) : failed && !places.length ? (
        <p className="text-sm text-muted-foreground">Nearby help is unavailable right now.</p>
      ) : !places.length ? (
        <p className="text-sm text-muted-foreground">No police stations or hospitals found within 10 km.</p>
      ) : (
        <div className="space-y-3">{places.map((p) => <HelpCard key={p.id} p={p} />)}</div>
      )}
    </section>
  );
}
