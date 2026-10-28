import { useState } from "react";
import { Bell, MapPin, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-state";
import { requestMotionPermission } from "@/triggers/shake";
import { getPosition } from "@/services/location";

const STEPS = [
  {
    icon: ShieldCheck,
    title: "Welcome to Safe Her",
    body: "One tap sends your location to the people you trust. Safe Her supplements — it does not replace — official emergency services.",
    action: null,
  },
  {
    icon: MapPin,
    title: "Location",
    body: "Used only when you send an SOS or share a trip, so your contacts can find you. GPS works even without internet.",
    action: "location",
  },
  {
    icon: Smartphone,
    title: "Motion sensors",
    body: "Lets you start an SOS by shaking your phone three times. Only works while the app is open on screen.",
    action: "motion",
  },
  {
    icon: Bell,
    title: "Notifications",
    body: "So we can tell you when a contact is responding to your alert.",
    action: "notify",
  },
] as const;

export function Onboarding() {
  const { updateSettings } = useApp();
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const s = STEPS[i];
  const next = () => (i < STEPS.length - 1 ? setI(i + 1) : updateSettings({ onboarded: true }));

  const allow = async () => {
    setBusy(true);
    try {
      if (s.action === "location") await getPosition(10000);
      if (s.action === "motion") {
        const ok = await requestMotionPermission();
        if (ok) updateSettings({ shakeEnabled: true });
      }
      if (s.action === "notify" && "Notification" in window) await Notification.requestPermission();
    } finally {
      setBusy(false);
      next();
    }
  };

  const Icon = s.icon;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-between p-6">
      <div className="flex gap-2 pt-4">
        {STEPS.map((_, k) => (
          <div key={k} className={`h-1.5 flex-1 rounded-full ${k <= i ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-accent">
          <Icon className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">{s.title}</h1>
        <p className="text-lg text-muted-foreground">{s.body}</p>
      </div>
      <div className="space-y-3 pb-6">
        {s.action ? (
          <>
            <Button size="lg" className="h-14 w-full rounded-2xl text-lg" onClick={allow} disabled={busy}>
              {busy ? "Waiting…" : "Allow"}
            </Button>
            <Button size="lg" variant="ghost" className="h-12 w-full" onClick={next}>
              Not now
            </Button>
          </>
        ) : (
          <Button size="lg" className="h-14 w-full rounded-2xl text-lg" onClick={next}>
            Get started
          </Button>
        )}
      </div>
    </div>
  );
}
