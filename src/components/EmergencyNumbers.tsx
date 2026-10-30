import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_EMERGENCY_NUMBERS, type EmergencyNumber } from "@/lib/settings";

export function EmergencyNumbers({ numbers = DEFAULT_EMERGENCY_NUMBERS }: { numbers?: EmergencyNumber[] }) {
  return <section aria-label="Emergency numbers" className="space-y-2">
    <h2 className="text-sm font-semibold">Emergency numbers</h2>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {numbers.filter(n => n.number).map((n, i) => <Button key={i} asChild variant="outline" className="h-auto min-h-16 whitespace-normal px-2 py-2">
        <a href={`tel:${n.number}`} aria-label={`Call ${n.number} ${n.label}`} className="flex flex-col gap-1 text-center">
          <span className="flex items-center gap-1 font-bold"><Phone className="h-3 w-3" />{n.number}</span>
          <span className="text-[11px] font-normal">{n.label}</span>
        </a>
      </Button>)}
    </div>
  </section>;
}