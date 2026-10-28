import { describe, expect, it } from "vitest";
import { buildEmergencyMessage, haversineKm, smsUri } from "@/lib/geo";

describe("emergency helpers", () => {
  it("haversine: Delhi to Mumbai is about 1150 km", () => {
    const d = haversineKm({ lat: 28.6139, lng: 77.209 }, { lat: 19.076, lng: 72.8777 });
    expect(d).toBeGreaterThan(1130);
    expect(d).toBeLessThan(1170);
  });

  it("android sms uri uses sms:num1,num2?body=", () => {
    expect(smsUri(["+91 98 765", "+1-555"], "hi there", "android")).toBe("sms:+9198765,+1555?body=hi%20there");
  });

  it("ios sms uri uses sms:/open?addresses=...&body=", () => {
    expect(smsUri(["+91 98765", "+1555"], "hi", "ios")).toBe("sms:/open?addresses=+9198765,+1555&body=hi");
  });

  it("message includes maps link and says how old a last known location is", () => {
    const m = buildEmergencyMessage({ lat: 12.5, lng: 77.25, at: new Date(), ageMinutes: 12 });
    expect(m).toContain("EMERGENCY! I need help.");
    expect(m).toContain("https://maps.google.com/?q=12.500000,77.250000");
    expect(m).toContain("12 min old");
    expect(m.endsWith("- Safe Her")).toBe(true);
  });
});
