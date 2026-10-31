import { useEffect, useRef } from "react";
import type * as L from "leaflet";

export type MapMarker = {
  id?: string;
  lat: number;
  lng: number;
  label?: string;
  kind?: "me" | "place" | "target" | "police" | "hospital";
};

const COLORS: Record<NonNullable<MapMarker["kind"]>, string> = {
  me: "#f43f5e",
  target: "#f43f5e",
  place: "#a78bfa",
  police: "#3b82f6", // blue
  hospital: "#ef4444", // red
};

/** Leaflet + OpenStreetMap. Leaflet is imported dynamically (browser only). */
export function MapView({
  center,
  markers = [],
  trail = [],
  accuracy,
  radiusKm,
  focusId = null,
  onMarkerClick,
  className = "h-64",
  zoom = 15,
}: {
  center: { lat: number; lng: number } | null;
  markers?: MapMarker[];
  trail?: { lat: number; lng: number }[];
  accuracy?: number | null;
  /** Draw a dashed search-radius circle (in km) around the center. */
  radiusKm?: number;
  /** Pan to this marker and open its popup. */
  focusId?: string | null;
  onMarkerClick?: (id: string) => void;
  className?: string;
  zoom?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const lib = useRef<typeof L | null>(null);
  const fitted = useRef(false);
  const markerRefs = useRef(new Map<string, L.Marker>());

  useEffect(() => {
    let disposed = false;
    void import("leaflet").then((mod) => {
      const Lm = (mod.default ?? mod) as typeof L;
      if (disposed || !el.current || map.current) return;
      lib.current = Lm;
      map.current = Lm.map(el.current, { zoomControl: true, attributionControl: true }).setView(
        center ? [center.lat, center.lng] : [20, 78],
        center ? zoom : 4,
      );
      Lm.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map.current);
      layer.current = Lm.layerGroup().addTo(map.current);
      draw();
    });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function draw() {
    const Lm = lib.current;
    if (!Lm || !map.current || !layer.current) return;
    layer.current.clearLayers();
    markerRefs.current.clear();
    if (trail.length > 1)
      Lm.polyline(trail.map((p) => [p.lat, p.lng] as [number, number]), { color: "#f472b6", weight: 4, opacity: 0.8 }).addTo(layer.current);
    if (center && accuracy) Lm.circle([center.lat, center.lng], { radius: accuracy, color: "#f472b6", weight: 1, fillOpacity: 0.12 }).addTo(layer.current);
    if (center && radiusKm)
      Lm.circle([center.lat, center.lng], { radius: radiusKm * 1000, color: "#3b82f6", weight: 2, dashArray: "6 6", fillOpacity: 0.05 }).addTo(layer.current);
    const all = [...markers];
    if (center && !markers.some((m) => m.kind === "me" || m.kind === "target")) all.push({ ...center, kind: "me", label: "You" });
    for (const m of all) {
      const kind = m.kind ?? "target";
      const color = COLORS[kind];
      const size = kind === "police" || kind === "hospital" ? 16 : kind === "place" ? 14 : 20;
      const icon = Lm.divIcon({
        className: "",
        html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 0 0 4px ${color}55"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const mk = Lm.marker([m.lat, m.lng], { icon }).addTo(layer.current);
      if (m.label) mk.bindPopup(m.label);
      if (m.id) {
        markerRefs.current.set(m.id, mk);
        if (onMarkerClick) mk.on("click", () => onMarkerClick(m.id!));
      }
    }
    if (!fitted.current && all.length > 1) {
      map.current.fitBounds(Lm.latLngBounds(all.map((m) => [m.lat, m.lng] as [number, number])), { padding: [30, 30], maxZoom: 15 });
      fitted.current = true;
    } else if (center) {
      if (!fitted.current) map.current.setView([center.lat, center.lng], zoom);
      else if (all.length <= 1) map.current.panTo([center.lat, center.lng]);
      fitted.current = true;
    }
  }

  useEffect(draw); // redraw on every prop change

  // Focus a marker (from a card click): pan and open its popup.
  useEffect(() => {
    if (!focusId || !map.current) return;
    const mk = markerRefs.current.get(focusId);
    if (!mk) return;
    map.current.panTo(mk.getLatLng(), { animate: true });
    mk.openPopup();
  }, [focusId]);

  return <div ref={el} className={`w-full overflow-hidden rounded-2xl border ${className}`} />;
}
