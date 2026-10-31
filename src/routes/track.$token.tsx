import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { HandHeart, Phone, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MapView } from "@/components/MapView";
import { NearbyHelp } from "@/components/NearbyHelp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/track/$token")({
  head: () => ({
    meta: [
      { title: "Live location — Safe Her" },
      { name: "description", content: "Someone who trusts you is sharing their live location." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Live location — Safe Her" },
      { property: "og:description", content: "Follow a trusted contact's live location." },
    ],
  }),
  component: Track,
});

type Loc = { lat: number; lng: number; accuracy: number | null; recorded_at: string };
type Data = { found: boolean; active?: boolean; kind?: string; sender_name?: string; started_at?: string; expires_at?: string; locations?: Loc[] };

function Track() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [responded, setResponded] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: d, error } = await supabase.rpc("get_tracking", { _token: token });
    if (error) setErr("Couldn't load location. Retrying…");
    else {
      setErr(null);
      setData(d as Data);
    }
  }, [token]);

  // Refresh every 5 s (matches sender's push rate)
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  const respond = async () => {
    setBusy(true);
    const { data: ok } = await supabase.rpc("respond_to_alert", { _token: token, _name: name });
    setBusy(false);
    if (ok) setResponded(true);
  };

  if (!data)
    return <div className="flex min-h-screen items-center justify-center">{err ?? <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />}</div>;
  if (!data.found || !data.active)
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <Shield className="h-14 w-14 text-success" />
        <h1 className="text-2xl font-bold">{data.found ? "Sharing has ended" : "Link not found"}</h1>
        <p className="text-muted-foreground">{data.found ? `${data.sender_name ?? "Your contact"} is no longer sharing their location.` : "This tracking link is invalid or has expired."}</p>
      </div>
    );

  const locs = data.locations ?? [];
  const last = locs[locs.length - 1];
  const sos = data.kind === "sos";

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className={`rounded-3xl p-5 ${sos ? "bg-sos text-sos-foreground" : "bg-card"}`}>
        <p className="text-sm font-semibold uppercase tracking-wider opacity-90">{sos ? "Emergency alert" : "Trip sharing"}</p>
        <h1 className="mt-1 text-2xl font-bold">{data.sender_name ?? "Your contact"} {sos ? "needs help" : "is sharing their trip"}</h1>
        <p className="mt-1 text-sm opacity-90">Since {data.started_at ? new Date(data.started_at).toLocaleTimeString() : ""}</p>
      </div>
      <MapView center={last ?? null} trail={locs} accuracy={last?.accuracy ?? null} markers={last ? [{ lat: last.lat, lng: last.lng, kind: "target", label: data.sender_name ?? "Contact" }] : []} className="h-80" />
      <p className="text-sm text-muted-foreground">
        {last ? `Last updated ${new Date(last.recorded_at).toLocaleTimeString()} · accuracy ±${Math.round(last.accuracy ?? 0)} m` : "Waiting for first location…"}
        {err ? ` · ${err}` : ""}
      </p>
      {last && (
        <Button asChild variant="secondary" className="h-12 w-full rounded-2xl">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${last.lat},${last.lng}`} target="_blank" rel="noreferrer">Get directions</a>
        </Button>
      )}
      {sos && <NearbyHelp origin={last ? { lat: last.lat, lng: last.lng } : null} />}
      <Button asChild size="lg" variant="destructive" className="h-14 w-full rounded-2xl"><a href="tel:112"><Phone className="mr-2 h-5 w-5" /> Call emergency services</a></Button>
      {responded ? (
        <p className="rounded-2xl bg-success/15 p-4 text-center font-semibold text-success">They've been told you're responding.</p>
      ) : (
        <div className="space-y-2 rounded-2xl bg-card p-4">
          <Input placeholder="Your name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="h-12" />
          <Button size="lg" className="h-14 w-full rounded-2xl" disabled={busy} onClick={() => void respond()}><HandHeart className="mr-2 h-5 w-5" /> I'm responding</Button>
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">Safe Her supplements, and does not replace, official emergency services.</p>
    </div>
  );
}
