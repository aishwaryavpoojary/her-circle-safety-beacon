import type { Sensitivity } from "@/lib/settings";
import type { Trigger } from "./TriggerManager";

const THRESHOLDS: Record<Sensitivity, number> = { low: 30, medium: 22, high: 16 };

/** iOS 13+ requires a user gesture to grant motion access. */
export async function requestMotionPermission(): Promise<boolean> {
  const DME = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
  if (!DME) return false;
  if (typeof DME.requestPermission === "function") {
    try {
      return (await DME.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

/** Three strong shakes within 2 seconds. */
export function shakeTrigger(sensitivity: Sensitivity): Trigger {
  return {
    id: "shake",
    label: "Shake phone",
    start(fire) {
      const threshold = THRESHOLDS[sensitivity];
      let peaks: number[] = [];
      let lastPeak = 0;
      const onMotion = (e: DeviceMotionEvent) => {
        const a = e.accelerationIncludingGravity;
        if (!a) return;
        const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
        const now = Date.now();
        if (mag > threshold && now - lastPeak > 250) {
          lastPeak = now;
          peaks = [...peaks.filter((t) => now - t < 2000), now];
          if (peaks.length >= 3) {
            peaks = [];
            fire();
          }
        }
      };
      window.addEventListener("devicemotion", onMotion);
      return () => window.removeEventListener("devicemotion", onMotion);
    },
  };
}
