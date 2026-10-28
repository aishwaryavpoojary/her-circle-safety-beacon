import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { History, LogOut, Trash2, Upload, Mic } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-state";
import { COUNTRY_NUMBERS, type Sensitivity } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";
import { clipAdd, clipRemove, clipsAll, wipeLocal, type Clip } from "@/lib/db";
import { requestMotionPermission } from "@/triggers/shake";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Safe Her" },
      { name: "description", content: "Emergency number, PIN, shake trigger, fake caller, test mode and privacy controls." },
      { property: "og:title", content: "Settings — Safe Her" },
      { property: "og:description", content: "Configure your Safe Her safety settings." },
    ],
  }),
  component: SettingsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-3xl bg-card p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

type AlertRow = { id: string; kind: string; status: string; started_at: string; ended_at: string | null; is_test: boolean };

function SettingsPage() {
  const { settings, updateSettings, session, signOut, guest } = useApp();
  const [pin, setPin] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [history, setHistory] = useState<AlertRow[] | null>(null);
  const [histErr, setHistErr] = useState<string | null>(null);

  useEffect(() => {
    void clipsAll().then(setClips);
    if (session)
      void supabase.from("alerts").select("id,kind,status,started_at,ended_at,is_test").order("started_at", { ascending: false }).limit(20)
        .then(({ data, error }) => (error ? setHistErr(error.message) : setHistory(data)));
  }, [session]);

  const toggleShake = async (on: boolean) => {
    if (on && !(await requestMotionPermission())) return void toast.error("Motion access was not allowed on this device");
    updateSettings({ shakeEnabled: on });
  };

  const photo = (f: File) => {
    if (f.size > 2_000_000) return void toast.error("Pick an image under 2 MB");
    const r = new FileReader();
    r.onload = () => updateSettings({ fakeCaller: { ...settings.fakeCaller, photo: String(r.result) } });
    r.readAsDataURL(f);
  };

  const addClip = async (f: File) => {
    if (f.size > 10_000_000) return void toast.error("Clip must be under 10 MB");
    const c = { id: crypto.randomUUID(), name: f.name, blob: f };
    await clipAdd(c);
    setClips([...clips, c]);
    toast.success("Voice clip saved on this phone");
  };

  const deleteAll = async () => {
    if (!confirm("Delete all your Safe Her data? This removes contacts, alerts and settings and cannot be undone.")) return;
    if (session) {
      await supabase.from("alerts").delete().eq("user_id", session.user.id);
      await supabase.from("contacts").delete().eq("user_id", session.user.id);
    }
    await wipeLocal();
    await signOut();
    window.location.href = "/";
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Section title="Profile">
        <div className="space-y-2"><Label htmlFor="dn">Your name (shown in alerts)</Label>
          <Input id="dn" className="h-12" value={settings.displayName} onChange={(e) => updateSettings({ displayName: e.target.value })}
            onBlur={() => session && void supabase.from("profiles").update({ display_name: settings.displayName }).eq("id", session.user.id)} />
        </div>
        <p className="text-sm text-muted-foreground">{session ? `Signed in as ${session.user.email}` : "Guest mode — data stays on this phone"}</p>
      </Section>

      <Section title="Emergency">
        <div className="space-y-2"><Label>Emergency number</Label>
          <Select value={COUNTRY_NUMBERS.some((c) => c.number === settings.emergencyNumber) ? settings.emergencyNumber : "custom"} onValueChange={(v) => v !== "custom" && updateSettings({ emergencyNumber: v })}>
            <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
            <SelectContent>{COUNTRY_NUMBERS.map((c) => <SelectItem key={c.number} value={c.number}>{c.label}</SelectItem>)}<SelectItem value="custom">Custom</SelectItem></SelectContent>
          </Select>
          <Input className="h-12" inputMode="tel" value={settings.emergencyNumber} onChange={(e) => updateSettings({ emergencyNumber: e.target.value.replace(/[^\d+]/g, "") })} />
        </div>
        <div className="space-y-2"><Label htmlFor="pin">Cancel PIN {settings.pin ? "(set)" : "(not set)"}</Label>
          <div className="flex gap-2">
            <Input id="pin" type="password" inputMode="numeric" maxLength={8} placeholder="4–8 digits" className="h-12" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
            <Button className="h-12" onClick={() => { if (pin.length < 4) return void toast.error("Use at least 4 digits"); updateSettings({ pin }); setPin(""); toast.success("PIN saved"); }}>Save</Button>
            {settings.pin && <Button variant="ghost" className="h-12" onClick={() => updateSettings({ pin: "" })}>Remove</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Needed to cancel an alert or mark yourself safe.</p>
        </div>
        <div className="flex items-center justify-between"><div><p className="font-medium">Test SOS mode</p><p className="text-xs text-muted-foreground">Runs the whole flow without messaging real contacts</p></div><Switch checked={settings.testMode} onCheckedChange={(v) => updateSettings({ testMode: v })} /></div>
      </Section>

      <Section title="Triggers">
        <div className="flex items-center justify-between"><div><p className="font-medium">Shake to SOS</p><p className="text-xs text-muted-foreground">3 strong shakes within 2 seconds</p></div><Switch checked={settings.shakeEnabled} onCheckedChange={(v) => void toggleShake(v)} /></div>
        <div className="space-y-2"><Label>Shake sensitivity</Label>
          <div className="grid grid-cols-3 gap-2">{(["low", "medium", "high"] as Sensitivity[]).map((s) => (
            <Button key={s} variant={settings.shakeSensitivity === s ? "default" : "secondary"} className="h-11 capitalize" onClick={() => updateSettings({ shakeSensitivity: s })}>{s}</Button>
          ))}</div>
        </div>
        <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">Shake detection works only while the app is open on screen.</p>
        <div className="rounded-xl bg-muted p-3 text-sm"><p className="font-medium">Power button trigger (Android app only)</p><p className="text-xs text-muted-foreground">Web browsers can't read the power button. Use the Stealth screen, the "SOS" app-icon shortcut (long-press the icon) or the <Link to="/quick" className="underline">quick-launch page</Link> instead.</p></div>
        <Button asChild variant="secondary" className="h-12 w-full"><Link to="/stealth">Open Stealth screen</Link></Button>
      </Section>

      <Section title="Fake caller">
        <div className="space-y-2"><Label htmlFor="fn">Caller name</Label><Input id="fn" className="h-12" value={settings.fakeCaller.name} onChange={(e) => updateSettings({ fakeCaller: { ...settings.fakeCaller, name: e.target.value } })} /></div>
        <div className="space-y-2"><Label htmlFor="fnum">Caller number</Label><Input id="fnum" className="h-12" value={settings.fakeCaller.number} onChange={(e) => updateSettings({ fakeCaller: { ...settings.fakeCaller, number: e.target.value } })} /></div>
        <div className="flex items-center gap-3">
          {settings.fakeCaller.photo && <img src={settings.fakeCaller.photo} alt="" className="h-14 w-14 rounded-full object-cover" />}
          <label className="inline-flex h-11 cursor-pointer items-center rounded-md bg-secondary px-4 text-sm font-medium"><Upload className="mr-2 h-4 w-4" /> Caller photo<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && photo(e.target.files[0])} /></label>
          {settings.fakeCaller.photo && <Button variant="ghost" size="sm" onClick={() => updateSettings({ fakeCaller: { ...settings.fakeCaller, photo: "" } })}>Remove</Button>}
        </div>
        <div className="space-y-2"><Label>Ringtone volume</Label><Slider min={0} max={1} step={0.05} value={[settings.ringVolume]} onValueChange={(v) => updateSettings({ ringVolume: v[0] ?? 0.7 })} /></div>
        <div className="grid grid-cols-2 gap-2">{([2, 3] as const).map((t) => <Button key={t} variant={settings.ringTones === t ? "default" : "secondary"} onClick={() => updateSettings({ ringTones: t })}>{t}-tone ring</Button>)}</div>
        <div className="space-y-2">
          <Label>Voice clips (played when you answer)</Label>
          {clips.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm"><Mic className="h-4 w-4" /><span className="flex-1 truncate">{c.name}</span>
              <button onClick={async () => { await clipRemove(c.id); setClips(clips.filter((x) => x.id !== c.id)); }} className="text-destructive"><Trash2 className="h-4 w-4" /></button></div>
          ))}
          <label className="inline-flex h-11 cursor-pointer items-center rounded-md bg-secondary px-4 text-sm font-medium"><Upload className="mr-2 h-4 w-4" /> Add audio clip<input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && void addClip(e.target.files[0])} /></label>
        </div>
      </Section>

      <Section title="SMS without internet">
        <p className="text-sm text-muted-foreground">When there's no internet, SOS opens your messages app with your contacts and location filled in. <strong className="text-foreground">You must tap Send.</strong> Fully automatic SMS without internet needs the native Android version.</p>
      </Section>

      <Section title="Alert history">
        {!session ? <p className="text-sm text-muted-foreground">Sign in to keep an alert history.</p>
          : histErr ? <p className="text-sm text-destructive">{histErr}</p>
          : !history ? <p className="text-sm text-muted-foreground">Loading…</p>
          : history.length === 0 ? <p className="text-sm text-muted-foreground">No alerts yet.</p>
          : <ul className="space-y-2">{history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2 text-sm"><History className="h-4 w-4" />
                <span className="flex-1">{h.kind === "trip" ? "Trip" : "SOS"}{h.is_test ? " (test)" : ""} · {new Date(h.started_at).toLocaleString()}</span>
                <span className={h.status === "active" ? "text-sos" : "text-muted-foreground"}>{h.status}</span></li>
            ))}</ul>}
      </Section>

      <Section title="Privacy">
        <p className="text-sm text-muted-foreground">Location is collected only during an active alert or trip, and a banner shows while sharing. Contacts can see your location only from the link you send them, and it stops working when the alert ends or after 24 hours.</p>
        <Button variant="destructive" className="h-12 w-full" onClick={() => void deleteAll()}><Trash2 className="mr-2 h-4 w-4" /> Delete all my data</Button>
        {(session || guest) && <Button variant="secondary" className="h-12 w-full" onClick={() => void signOut()}><LogOut className="mr-2 h-4 w-4" /> {session ? "Sign out" : "Leave guest mode"}</Button>}
      </Section>

      <p className="pb-4 text-center text-xs text-muted-foreground">Safe Her supplements, and does not replace, official emergency services.</p>
    </div>
  );
}
