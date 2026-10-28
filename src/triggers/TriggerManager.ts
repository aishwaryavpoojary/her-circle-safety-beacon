/**
 * Trigger Manager: every way of starting an SOS registers here.
 * A native Android plugin (e.g. power-button presses via Capacitor) can call
 * registerTrigger({ id: "power-button", ... }) and fire() later without app changes.
 */
export type TriggerSource = "button" | "shake" | "stealth" | "shortcut" | "quick" | "power-button" | string;

export interface Trigger {
  id: TriggerSource;
  label: string;
  start: (fire: () => void) => void | (() => void);
}

type Listener = (source: TriggerSource) => void;

class Manager {
  private listeners = new Set<Listener>();
  private stops = new Map<string, () => void>();
  private lastFire = 0;

  registerTrigger(t: Trigger) {
    this.unregisterTrigger(t.id);
    const stop = t.start(() => this.fire(t.id));
    if (stop) this.stops.set(t.id, stop);
  }
  unregisterTrigger(id: string) {
    this.stops.get(id)?.();
    this.stops.delete(id);
  }
  onTrigger(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  /** Debounced: one gesture sequence cannot trigger twice within 5 s. */
  fire(source: TriggerSource) {
    const now = Date.now();
    if (now - this.lastFire < 5000) return;
    this.lastFire = now;
    this.listeners.forEach((l) => l(source));
  }
}

export const triggerManager = new Manager();
