import { useEffect, useState } from "react";
import { Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const h = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    const done = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", h);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", h);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  if (installed)
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-success">
        <CheckCircle2 className="h-4 w-4" /> Installed on this device
      </p>
    );
  if (!evt) return null;
  return (
    <Button variant="outline" className="h-12 rounded-2xl" onClick={async () => { await evt.prompt(); setEvt(null); }}>
      <Download className="mr-2 h-4 w-4" /> Install Safe Her on this phone
    </Button>
  );
}
