import { useEffect, useRef } from "react";
import type * as L from "leaflet";

export type MapMarker = { lat: number; lng: number; label?: string; kind?: "me" | "place" | "target" };

/** Leaflet + OpenStreetMap. Leaflet is imported dynamically (browser only). */
export function MapView({
  center,
  markers = [],
  trail = [],
  accuracy,
  className = "h-64",
  zoom = 15,
}: {
  center: { lat: number; lng: number } | null;
  markers?: MapMarker[];
  trail?: { lat: number; lng: number }[];
  accuracy?: number | null;
  className?: string;
  zoom?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const lib = useRef<typeof L | null>(null);
  const fitted = useRef(false);

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
    if (trail.length > 1)
      Lm.polyline(trail.map((p) => [p.lat, p.lng] as [number, number]), { color: "#f472b6", weight: 4, opacity: 0.8 }).addTo(layer.current);
    if (center && accuracy) Lm.circle([center.lat, center.lng], { radius: accuracy, color: "#f472b6", weight: 1, fillOpacity: 0.12 }).addTo(layer.current);
    const all = [...markers];
    if (center && !markers.some((m) => m.kind === "me" || m.kind === "target")) all.push({ ...center, kind: "me", label: "You" });
    for (const m of all) {
      const color = m.kind === "place" ? "#a78bfa" : "#f43f5e";
      const size = m.kind === "place" ? 14 : 20;
      const icon = Lm.divIcon({
        className: "",
        html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 0 0 4px ${color}55"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const mk = Lm.marker([m.lat, m.lng], { icon }).addTo(layer.current);
      if (m.label) mk.bindPopup(m.label);
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

  return <div ref={el} className={`w-full overflow-hidden rounded-2xl border ${className}`} />;
}
