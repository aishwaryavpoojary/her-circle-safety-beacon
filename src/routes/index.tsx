import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Navigation, Users, Wifi, WifiOff, Vibrate, MapPin, EyeOff } from "lucide-react";
import { useApp } from "@/lib/app-state";
import { Button } from "@/components/ui/button";
import { InstallPrompt } from "@/components/InstallPrompt";
import { EmergencyNumbers } from "@/components/EmergencyNumbers";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Safe Her — One-tap SOS & live location" },
      { name: "description", content: "Women's safety app: one-tap SOS, live location sharing with trusted contacts, offline SMS, nearby police and fake calls." },
      { property: "og:title", content: "Safe Her — One-tap SOS & live location" },
      { property: "og:description", content: "One tap alerts your trusted contacts with your live location." },
    ],
  }),
  component: Home,
});

function Chip({ ok, icon: Icon, children }: { ok: boolean; icon: typeof Wifi; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function Home() {
  const { online, settings, contacts, lastFix, startCountdown, active } = useApp();
  const [gps, setGps] = useState<"unknown" | "ok" | "denied">("unknown");
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (lastFix) setGps("ok");
    navigator.permissions?.query({ name: "geolocation" as PermissionName }).then((p) => {
      setGps(p.state === "granted" ? "ok" : p.state === "denied" ? "denied" : lastFix ? "ok" : "unknown");
    }).catch(() => {});
  }, [lastFix]);

  const down = () => {
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      setHolding(false);
      startCountdown("button");
    }, 2000);
  };
  const up = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setHolding(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Safe Her</h1>
        <Link to="/stealth" aria-label="Stealth screen" className="rounded-full bg-muted p-3 text-muted-foreground">
          <EyeOff className="h-5 w-5" />
        </Link>
      </header>
      <div className="flex flex-wrap gap-2">
        <Chip ok={gps === "ok"} icon={MapPin}>{gps === "ok" ? "GPS ready" : gps === "denied" ? "GPS blocked" : "GPS not checked"}</Chip>
        <Chip ok={online} icon={online ? Wifi : WifiOff}>{online ? "Online" : "Offline"}</Chip>
        <Chip ok={settings.shakeEnabled} icon={Vibrate}>Shake {settings.shakeEnabled ? "ON" : "OFF"}</Chip>
        <Chip ok={contacts.length > 0} icon={Users}>{contacts.length} contact{contacts.length === 1 ? "" : "s"}</Chip>
      </div>

      {settings.testMode && (
        <p className="rounded-2xl bg-warning/15 px-4 py-3 text-sm font-semibold text-warning">Test mode is on — no real messages will be sent.</p>
      )}

      <div className="flex flex-col items-center gap-6 py-8">
        <div className="relative flex items-center justify-center">
          <span className="pulse-ring absolute h-64 w-64 rounded-full bg-sos/30" />
          <button
            onClick={() => startCountdown("button")}
            onPointerDown={down}
            onPointerUp={up}
            onPointerLeave={up}
            className={`sos-button relative flex h-64 w-64 select-none flex-col items-center justify-center rounded-full transition-transform ${holding ? "scale-95" : "active:scale-95"}`}
            aria-label="Send SOS"
          >
            <span className="font-display text-7xl font-bold tracking-tight">SOS</span>
            <span className="mt-1 text-sm font-semibold opacity-90">Tap or hold 2s</span>
          </button>
        </div>
        {contacts.length === 0 && (
          <Link to="/contacts" className="text-sm font-semibold text-primary underline">Add trusted contacts so SOS can reach someone →</Link>
        )}
      </div>

      <EmergencyNumbers numbers={settings.emergencyNumbers} />
      <Button asChild size="lg" variant="secondary" className="h-16 rounded-2xl text-lg" disabled={!!active}>
        <Link to="/trip"><Navigation className="mr-2 h-5 w-5" /> Share my trip</Link>
      </Button>
      <InstallPrompt />
      <p className="text-center text-xs text-muted-foreground">Safe Her supplements, and does not replace, official emergency services. Call {settings.emergencyNumber} in an emergency.</p>
    </div>
  );
}
