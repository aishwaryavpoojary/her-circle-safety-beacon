import { createFileRoute, Link } from "@tanstack/react-router";
import { EyeOff, MapPin, Navigation, Phone, PhoneIncoming } from "lucide-react";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/quick")({
  head: () => ({
    meta: [
      { title: "Quick launch — Safe Her" },
      { name: "description", content: "Big one-tap tiles for SOS, fake call, stealth screen and nearby help." },
      { property: "og:title", content: "Quick launch — Safe Her" },
      { property: "og:description", content: "One-tap safety shortcuts." },
    ],
  }),
  component: Quick,
});

function Quick() {
  const { startCountdown, settings } = useApp();
  const tile = "flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl text-lg font-semibold";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Quick launch</h1>
      <p className="text-sm text-muted-foreground">Add this page to your home screen for widget-style access.</p>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => startCountdown("quick")} className={`${tile} sos-button col-span-2 aspect-[2/1] text-3xl`}>SOS</button>
        <Link to="/fake-call" search={{ now: 1 }} className={`${tile} bg-card`}><PhoneIncoming className="h-8 w-8 text-primary" />Fake call</Link>
        <Link to="/stealth" className={`${tile} bg-card`}><EyeOff className="h-8 w-8 text-primary" />Stealth</Link>
        <Link to="/trip" className={`${tile} bg-card`}><Navigation className="h-8 w-8 text-primary" />Share trip</Link>
        <Link to="/nearby" className={`${tile} bg-card`}><MapPin className="h-8 w-8 text-primary" />Police</Link>
        <a href={`tel:${settings.emergencyNumber}`} className={`${tile} col-span-2 aspect-[3/1] bg-destructive text-destructive-foreground`}><Phone className="h-8 w-8" />Call {settings.emergencyNumber}</a>
      </div>
    </div>
  );
}
