import { useEffect, useRef, useState } from "react";
import { Grid3x3, MicOff, Phone, PhoneOff, Volume2 } from "lucide-react";
import { useApp } from "@/lib/app-state";
import { startRingtone, vibrate } from "@/services/ringtone";
import { clipsAll } from "@/lib/db";

/** Full-screen incoming call → in-call UI. Works fully offline. */
export function FakeCallScreen({ onClose }: { onClose: () => void }) {
  const { settings } = useApp();
  const caller = settings.fakeCaller;
  const [phase, setPhase] = useState<"ringing" | "call">("ringing");
  const [secs, setSecs] = useState(0);
  const [mute, setMute] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  // Wake lock keeps the screen on
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, []);

  useEffect(() => {
    if (phase !== "ringing") return;
    const stop = startRingtone(settings.ringVolume, settings.ringTones);
    vibrate([800, 400, 800, 400, 800, 1600]);
    const v = setInterval(() => vibrate([800, 400, 800, 400, 800]), 4500);
    return () => {
      stop();
      clearInterval(v);
      vibrate(0);
    };
  }, [phase, settings.ringVolume, settings.ringTones]);

  useEffect(() => {
    if (phase !== "call") return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    void clipsAll().then((clips) => {
      const c = clips[0];
      if (!c) return;
      const a = new Audio(URL.createObjectURL(c.blob));
      a.volume = settings.ringVolume;
      audio.current = a;
      void a.play().catch(() => {});
    });
    return () => {
      clearInterval(t);
      audio.current?.pause();
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (audio.current) audio.current.muted = mute;
  }, [mute]);

  const avatar = caller.photo ? (
    <img src={caller.photo} alt="" className="h-32 w-32 rounded-full object-cover" />
  ) : (
    <div className="flex h-32 w-32 items-center justify-center rounded-full bg-accent font-display text-5xl font-bold">{caller.name.slice(0, 1).toUpperCase()}</div>
  );
  const mm = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-between bg-stealth px-8 pb-16 pt-24 text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{phase === "ringing" ? "Incoming call" : mm}</p>
        <div className={phase === "ringing" ? "ringing" : ""}>{avatar}</div>
        <h1 className="text-4xl font-semibold">{caller.name}</h1>
        <p className="text-muted-foreground">{caller.number}</p>
      </div>

      {phase === "ringing" ? (
        <div className="flex w-full max-w-xs justify-between">
          <button aria-label="Decline" onClick={onClose} className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
            <PhoneOff className="h-9 w-9" />
          </button>
          <button aria-label="Accept" onClick={() => setPhase("call")} className="flex h-20 w-20 animate-bounce items-center justify-center rounded-full bg-success text-success-foreground">
            <Phone className="h-9 w-9" />
          </button>
        </div>
      ) : (
        <div className="flex w-full max-w-xs flex-col items-center gap-10">
          {keypad ? (
            <div className="grid grid-cols-3 gap-4">
              {"123456789*0#".split("").map((k) => (
                <button key={k} onClick={() => vibrate(20)} className="h-16 w-16 rounded-full bg-muted text-2xl">{k}</button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {[
                { on: mute, set: () => setMute(!mute), icon: MicOff, label: "Mute" },
                { on: keypad, set: () => setKeypad(true), icon: Grid3x3, label: "Keypad" },
                { on: speaker, set: () => setSpeaker(!speaker), icon: Volume2, label: "Speaker" },
              ].map((b) => (
                <button key={b.label} onClick={b.set} className="flex flex-col items-center gap-2 text-xs">
                  <span className={`flex h-16 w-16 items-center justify-center rounded-full ${b.on ? "bg-foreground text-background" : "bg-muted"}`}><b.icon className="h-7 w-7" /></span>
                  {b.label}
                </button>
              ))}
            </div>
          )}
          {keypad && <button className="text-sm text-muted-foreground" onClick={() => setKeypad(false)}>Hide keypad</button>}
          <button aria-label="End call" onClick={onClose} className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
            <PhoneOff className="h-9 w-9" />
          </button>
        </div>
      )}
    </div>
  );
}
