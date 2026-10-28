import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Navigation } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/trip")({
  head: () => ({
    meta: [
      { title: "Share my trip — Safe Her" },
      { name: "description", content: "Share your live location with chosen contacts for a set time." },
      { property: "og:title", content: "Share my trip — Safe Her" },
      { property: "og:description", content: "Live trip sharing with trusted contacts." },
    ],
  }),
  component: Trip,
});

const DURATIONS = [15, 30, 60, 120, 240];

function Trip() {
  const { contacts, startTrip, session, online, active } = useApp();
  const navigate = useNavigate();
  const [chosen, setChosen] = useState<string[]>(() => contacts.map((c) => c.id));
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);

  if (active) return <div className="py-16 text-center"><p className="mb-4">Location sharing is already on.</p><Button asChild><Link to="/alert">View it</Link></Button></div>;
  if (!session)
    return (
      <div className="space-y-3 py-16 text-center">
        <h1 className="text-2xl font-bold">Sign in to share trips</h1>
        <p className="text-muted-foreground">Live tracking links need an account. Use SOS anytime — it works without one.</p>
      </div>
    );

  const go = async () => {
    if (!chosen.length) return void toast.error("Choose at least one contact");
    setBusy(true);
    try {
      await startTrip(chosen, minutes);
      void navigate({ to: "/alert" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Share my trip</h1>
      {contacts.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center">Add contacts first. <Link to="/contacts" className="text-primary underline">Add contacts</Link></p>
      ) : (
        <section className="space-y-2">
          <h2 className="font-semibold">Who can follow you</h2>
          {contacts.map((c) => (
            <label key={c.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-card px-4">
              <Checkbox checked={chosen.includes(c.id)} onCheckedChange={(v) => setChosen(v ? [...chosen, c.id] : chosen.filter((x) => x !== c.id))} />
              <span className="flex-1 font-medium">{c.name}</span>
              <span className="text-sm text-muted-foreground">{c.phone}</span>
            </label>
          ))}
        </section>
      )}
      <section className="space-y-2">
        <h2 className="font-semibold">For how long</h2>
        <div className="grid grid-cols-3 gap-2">
          {DURATIONS.map((d) => (
            <Button key={d} variant={minutes === d ? "default" : "secondary"} className="h-12 rounded-2xl" onClick={() => setMinutes(d)}>
              {d < 60 ? `${d} min` : `${d / 60} h`}
            </Button>
          ))}
        </div>
      </section>
      <Button size="lg" className="h-16 w-full rounded-2xl text-lg" disabled={busy || !online || !contacts.length} onClick={go}>
        <Navigation className="mr-2 h-5 w-5" /> {busy ? "Starting…" : online ? "Start sharing" : "You're offline"}
      </Button>
      <p className="text-xs text-muted-foreground">Your location is shared only during this trip. The link stops working when you stop or time runs out.</p>
    </div>
  );
}
