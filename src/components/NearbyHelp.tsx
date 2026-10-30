import { useEffect, useRef, useState } from "react";
import { Cross, Navigation, Phone, Shield, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { haversineKm } from "@/lib/geo";
import { directionsUrl, findNearest, formatKm, geoUrl, placeText, type Place } from "@/services/places";

export function PlaceItem({ place: p, mode = "driving", share = true }: { place: Place; mode?: "driving" | "walking"; share?: boolean }) {
  const police = p.type === "police";
  const Icon = police ? Shield : Cross;
  return <article className="space-y-3 rounded-lg border bg-card p-4">
    <div className="flex items-start gap-2">
      <Icon className={`mt-1 h-5 w-5 shrink-0 ${police ? "text-primary" : "text-success"}`} />
      <div className="min-w-0 flex-1 break-words"><h3 className="font-semibold">{p.name}</h3><p className="text-xs text-muted-foreground">{police ? "Police" : p.type === "clinic" ? "Clinic" : "Hospital"} · {formatKm(p.distanceKm)}</p></div>
    </div>
    {p.address && <p className="text-sm text-muted-foreground">{p.address}</p>}
    {p.phone && <p className="text-sm">{p.phone}</p>}
    {p.hours && <p className="text-xs text-muted-foreground">{p.hours}</p>}
    <div className="flex flex-wrap gap-2">
      <Button asChild={!!p.phone} variant="secondary" size="sm" disabled={!p.phone}>{p.phone ? <a href={`tel:${p.phone}`}><Phone className="mr-1 h-4 w-4" />Call</a> : <span>No phone listed</span>}</Button>
      <Button size="sm" onClick={() => { if (!window.open(directionsUrl(p, mode), "_blank", "noopener,noreferrer")) window.location.href = geoUrl(p); }}><Navigation className="mr-1 h-4 w-4" />Directions</Button>
      {share && <Button variant="outline" size="icon" aria-label={`Share ${p.name}`} title="Copy place details" onClick={async () => { try { await navigator.clipboard.writeText(placeText(p)); toast.success("Place details copied"); } catch { toast.error("Could not copy place details"); } }}><Share2 className="h-4 w-4" /></Button>}
    </div>
  </article>;
}

export function NearbyHelp({ origin }: { origin: { lat: number; lng: number } | null }) {
  const previous = useRef<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!origin || (previous.current && haversineKm(previous.current, origin) < 0.5)) return;
    let cancelled = false;
    previous.current = origin;
    setLoading(true); setError(false);
    void findNearest(origin).then(r => { if (!cancelled) setPlaces([r.police, r.hospital].filter((p): p is Place => !!p)); })
      .catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [origin?.lat, origin?.lng]);
  return <section className="space-y-3"><h2 className="text-lg font-semibold">Nearest help</h2>
    {!origin ? <p className="text-sm text-muted-foreground">Waiting for location…</p> : loading ? <p className="text-sm text-muted-foreground">Finding nearby help…</p> : error ? <p className="text-sm text-muted-foreground">Nearby help is unavailable.</p> : !places.length ? <p className="text-sm text-muted-foreground">No saved or nearby help found within 20 km.</p> : places.map(p => <PlaceItem key={p.id} place={{ ...p, distanceKm: origin ? haversineKm(origin, p) : p.distanceKm }} share={false} />)}
  </section>;
}