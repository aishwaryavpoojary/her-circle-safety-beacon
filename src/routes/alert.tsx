import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, MessageSquare, Phone, ShieldCheck, Copy } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapView } from "@/components/MapView";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/alert")({
  head: () => ({
    meta: [
      { title: "Alert active — Safe Her" },
      { name: "description", content: "Your SOS is active and your live location is being shared." },
      { property: "og:title", content: "Alert active — Safe Her" },
      { property: "og:description", content: "Live SOS status and location sharing." },
    ],
  }),
  component: AlertPage,
});

function AlertPage() {
  const { active, settings, lastFix, responders, endActive, trackingUrl, online } = useApp();
  const navigate = useNavigate();
  const [pinOpen, setPinOpen] = useState<null | "safe" | "cancel">(null);
  const [pin, setPin] = useState("");

  if (!active)
    return (
      <div className="space-y-4 py-20 text-center">
        <ShieldCheck className="mx-auto h-14 w-14 text-success" />
        <h1 className="text-2xl font-bold">No active alert</h1>
        <Button asChild><Link to="/">Back home</Link></Button>
      </div>
    );

  const finish = async (mode: "safe" | "cancel") => {
    if (settings.pin && pin !== settings.pin) return void toast.error("Wrong PIN");
    setPinOpen(null);
    setPin("");
    await endActive({ sendAllClear: mode === "safe" });
    void navigate({ to: "/" });
  };
  const ask = (mode: "safe" | "cancel") => (settings.pin ? setPinOpen(mode) : void finish(mode));

  const isTrip = active.kind === "trip";
  const link = active.token ? trackingUrl(active.token) : null;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-sos p-5 text-sos-foreground">
        <p className="text-sm font-semibold uppercase tracking-wider opacity-90">{active.isTest ? "Test · " : ""}{isTrip ? "Trip sharing" : "Alert active"}</p>
        <h1 className="mt-1 text-2xl font-bold">
          {active.channel === "server" ? `${active.notified.length} contact(s) notified by SMS` : active.channel === "test" ? "Test run — no messages sent" : "Send the SMS in your messages app"}
        </h1>
        <p className="mt-1 text-sm opacity-90">Started {new Date(active.startedAt).toLocaleTimeString()}{active.endsAt ? ` · ends ${new Date(active.endsAt).toLocaleTimeString()}` : ""}</p>
        {active.notified.length > 0 && <p className="mt-2 text-sm">To: {active.notified.join(", ")}</p>}
      </div>

      {responders.length > 0 && (
        <div className="space-y-2 rounded-2xl bg-success/15 p-4 text-success">
          {responders.map((r) => (
            <p key={r.id} className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" /> {r.name} is responding · {new Date(r.at).toLocaleTimeString()}</p>
          ))}
        </div>
      )}

      {active.channel !== "server" && active.smsLink && !active.isTest && (
        <Button asChild size="lg" className="h-14 w-full rounded-2xl"><a href={active.smsLink}><MessageSquare className="mr-2 h-5 w-5" /> Open SMS again</a></Button>
      )}
      {active.channel === "test" && <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Message preview: {active.message}</p>}

      <MapView center={lastFix} accuracy={lastFix?.accuracy ?? null} className="h-64" />
      <p className="text-xs text-muted-foreground">
        {lastFix ? `Last fix ${new Date(lastFix.at).toLocaleTimeString()} · ±${Math.round(lastFix.accuracy ?? 0)} m` : "Waiting for GPS…"}
        {!online && active.alertId ? " · offline: points are saved and will sync" : ""}
        {!active.alertId ? " · live tracking link needs an account and internet" : ""}
      </p>

      {link && (
        <Button variant="outline" className="h-12 w-full rounded-2xl" onClick={() => { void navigator.clipboard?.writeText(link); toast.success("Tracking link copied"); }}>
          <Copy className="mr-2 h-4 w-4" /> Copy tracking link
        </Button>
      )}

      {!isTrip && (
        <Button asChild size="lg" variant="destructive" className="h-16 w-full rounded-2xl text-lg">
          <a href={`tel:${settings.emergencyNumber}`}><Phone className="mr-2 h-5 w-5" /> Call {settings.emergencyNumber}</a>
        </Button>
      )}
      <Button size="lg" className="h-16 w-full rounded-2xl bg-success text-lg text-success-foreground hover:bg-success/90" onClick={() => ask("safe")}>
        {isTrip ? "I've arrived — stop sharing" : "I'm safe"}
      </Button>
      {!isTrip && <Button variant="ghost" className="w-full" onClick={() => ask("cancel")}>Cancel alert (no all-clear SMS)</Button>}

      <Dialog open={!!pinOpen} onOpenChange={(o) => !o && setPinOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enter your PIN</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (pinOpen) void finish(pinOpen); }} className="space-y-4">
            <Input autoFocus inputMode="numeric" type="password" value={pin} onChange={(e) => setPin(e.target.value)} className="h-14 text-center text-2xl tracking-[0.5em]" />
            <Button type="submit" className="h-12 w-full">Confirm</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
