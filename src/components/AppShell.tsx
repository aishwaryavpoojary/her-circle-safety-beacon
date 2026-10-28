import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, MapPin, Phone, Settings as Cog, Users, Radio, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useApp } from "@/lib/app-state";
import { Button } from "@/components/ui/button";
import { Onboarding } from "@/components/Onboarding";
import { AuthScreen } from "@/components/AuthScreen";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/nearby", label: "Nearby", icon: MapPin },
  { to: "/fake-call", label: "Fake Call", icon: Phone },
  { to: "/settings", label: "Settings", icon: Cog },
] as const;

// Routes that render without nav/gating
const BARE = ["/track/", "/stealth"];
const FULLSCREEN = ["/stealth", "/fake-call/ring"];

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const app = useApp();
  const navigate = useNavigate();

  // Manifest shortcuts: /?action=sos
  useEffect(() => {
    if (!app.ready) return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("action") === "sos") {
      app.startCountdown("shortcut");
      void navigate({ to: "/", replace: true });
    }
  }, [app.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (BARE.some((b) => pathname.startsWith(b))) return <>{children}</>;

  if (!app.ready)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  if (!app.settings.onboarded) return <Onboarding />;
  if (!app.session && !app.guest) return <AuthScreen />;

  const fullscreen = FULLSCREEN.some((f) => pathname.startsWith(f));

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      {app.active && pathname !== "/alert" && (
        <div className="sticky top-0 z-40 flex items-center gap-3 bg-sos px-4 py-2.5 text-sos-foreground">
          <Radio className="h-4 w-4 animate-pulse" />
          <Link to="/alert" className="flex-1 text-sm font-semibold">
            Location sharing active{app.active.isTest ? " (test)" : ""} — tap to view
          </Link>
          <Button size="sm" variant="secondary" className="h-8" onClick={() => void navigate({ to: "/alert" })}>
            <X className="mr-1 h-3 w-3" /> Stop
          </Button>
        </div>
      )}
      <main className={fullscreen ? "flex-1" : "flex-1 px-4 pb-28 pt-4"}>{children}</main>
      {!fullscreen && (
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <ul className="grid grid-cols-5">
            {NAV.map(({ to, label, icon: Icon }) => {
              const on = to === "/" ? pathname === "/" : pathname.startsWith(to);
              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${on ? "text-primary" : "text-muted-foreground"}`}
                  >
                    <Icon className="h-6 w-6" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      <CountdownOverlay />
    </div>
  );
}

function CountdownOverlay() {
  const { countdown, cancelCountdown, triggering, active } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    if (active && !triggering) void navigate({ to: "/alert" });
  }, [active?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!countdown && !triggering) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 bg-background/95 p-6 backdrop-blur" role="alertdialog" aria-label="SOS countdown">
      {countdown ? (
        <>
          <p className="text-lg font-semibold text-muted-foreground">Sending SOS in</p>
          <div className="sos-button flex h-48 w-48 items-center justify-center rounded-full font-display text-8xl font-bold">{countdown.remaining}</div>
          <Button size="lg" variant="secondary" className="h-20 w-full max-w-xs rounded-3xl text-2xl font-bold" onClick={cancelCountdown}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-sos border-t-transparent" />
          <p className="text-xl font-semibold">Getting location & alerting contacts…</p>
        </>
      )}
    </div>
  );
}
