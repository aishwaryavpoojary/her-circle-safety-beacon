import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PhoneIncoming, Timer, X } from "lucide-react";
import { z } from "zod";
import { useApp } from "@/lib/app-state";
import { Button } from "@/components/ui/button";
import { FakeCallScreen } from "@/components/FakeCallScreen";

export const Route = createFileRoute("/fake-call")({
  validateSearch: z.object({ now: z.coerce.number().optional() }),
  head: () => ({
    meta: [
      { title: "Fake call — Safe Her" },
      { name: "description", content: "Schedule a realistic incoming call to get out of an uncomfortable situation. Works offline." },
      { property: "og:title", content: "Fake call — Safe Her" },
      { property: "og:description", content: "A realistic fake incoming call, fully offline." },
    ],
  }),
  component: FakeCall,
});

const DELAYS = [
  { s: 0, label: "Now" },
  { s: 10, label: "10 sec" },
  { s: 30, label: "30 sec" },
  { s: 60, label: "1 min" },
  { s: 300, label: "5 min" },
];

function FakeCall() {
  const { settings } = useApp();
  const search = Route.useSearch();
  const [ringing, setRinging] = useState(false);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (search.now) setRinging(true);
  }, [search.now]);

  useEffect(() => {
    if (left == null) return;
    if (left <= 0) {
      setLeft(null);
      setRinging(true);
      return;
    }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const schedule = (s: number) => (s === 0 ? setRinging(true) : setLeft(s));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Fake call</h1>
      <div className="flex items-center gap-4 rounded-3xl bg-card p-5">
        {settings.fakeCaller.photo ? (
          <img src={settings.fakeCaller.photo} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent font-display text-2xl font-bold">{settings.fakeCaller.name.slice(0, 1)}</div>
        )}
        <div className="flex-1">
          <p className="text-lg font-semibold">{settings.fakeCaller.name}</p>
          <p className="text-sm text-muted-foreground">{settings.fakeCaller.number}</p>
        </div>
        <Link to="/settings" className="text-sm font-semibold text-primary">Edit</Link>
      </div>

      {left != null ? (
        <div className="space-y-4 rounded-3xl bg-accent p-8 text-center">
          <Timer className="mx-auto h-10 w-10 text-primary" />
          <p className="font-display text-5xl font-bold">{left}s</p>
          <p className="text-muted-foreground">Call coming. You can lock your screen — keep the app open.</p>
          <Button variant="secondary" onClick={() => setLeft(null)}><X className="mr-2 h-4 w-4" /> Cancel</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {DELAYS.map((d) => (
            <Button key={d.s} variant={d.s === 0 ? "default" : "secondary"} className={`h-16 rounded-2xl text-lg ${d.s === 0 ? "col-span-2" : ""}`} onClick={() => schedule(d.s)}>
              {d.s === 0 && <PhoneIncoming className="mr-2 h-5 w-5" />} {d.label}
            </Button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Works without internet. Ringtone, volume, caller photo and voice clips are in Settings. Also available from the Stealth screen (5 quick taps at the top) and the app icon shortcut.</p>
      {ringing && <FakeCallScreen onClose={() => setRinging(false)} />}
    </div>
  );
}
