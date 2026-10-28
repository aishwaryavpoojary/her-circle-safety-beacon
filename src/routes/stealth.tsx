import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-state";
import { FakeCallScreen } from "@/components/FakeCallScreen";

export const Route = createFileRoute("/stealth")({
  head: () => ({
    meta: [
      { title: "Safe Her" },
      { name: "description", content: "Discreet screen: 5 quick taps start SOS." },
      { property: "og:title", content: "Safe Her" },
      { property: "og:description", content: "Discreet SOS screen." },
    ],
  }),
  component: Stealth,
});

/** Looks like a locked/blank screen. 5 quick taps on the bottom = SOS countdown, top = fake call. Long-press clock to exit. */
function Stealth() {
  const { startCountdown, countdown, cancelCountdown, active } = useApp();
  const navigate = useNavigate();
  const [time, setTime] = useState<Date | null>(null);
  const [call, setCall] = useState(false);
  const taps = useRef<{ top: number[]; bottom: number[] }>({ top: [], bottom: [] });
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 10000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (active) void navigate({ to: "/alert" });
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (zone: "top" | "bottom") => {
    const now = Date.now();
    const list = [...taps.current[zone].filter((t) => now - t < 2000), now];
    taps.current[zone] = list;
    if (list.length >= 5) {
      taps.current[zone] = [];
      if (zone === "bottom") startCountdown("stealth");
      else setCall(true);
    }
  };

  return (
    <div className="fixed inset-0 flex select-none flex-col bg-stealth">
      <div className="flex flex-1 flex-col items-center justify-start pt-24" onClick={() => tap("top")}>
        <p
          className="font-display text-7xl font-light text-muted-foreground/40"
          onPointerDown={() => (hold.current = setTimeout(() => void navigate({ to: "/" }), 1500))}
          onPointerUp={() => hold.current && clearTimeout(hold.current)}
        >
          {time ? time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
        </p>
      </div>
      <div className="flex-1" onClick={() => tap("bottom")} />
      {countdown && (
        <button onClick={cancelCountdown} className="absolute inset-x-0 bottom-0 p-6 text-center text-sm text-muted-foreground/60">
          {countdown.remaining}… tap to cancel
        </button>
      )}
      {call && <FakeCallScreen onClose={() => setCall(false)} />}
    </div>
  );
}
