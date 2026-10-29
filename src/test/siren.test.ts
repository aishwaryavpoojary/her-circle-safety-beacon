import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareSiren, startSiren, stopSiren } from "@/services/siren";

const oscillators: Array<{ type: string; frequency: { value: number }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
const gains: Array<{ gain: { value: number }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
const resume = vi.fn().mockResolvedValue(undefined);
class AudioMock {
  state = "suspended";
  destination = {};
  resume = resume;
  createOscillator() {
    const node = { type: "sine", frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    oscillators.push(node);
    return node;
  }
  createGain() {
    const node = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
    gains.push(node);
    return node;
  }
}

afterEach(() => { stopSiren(); vi.unstubAllGlobals(); });

describe("SOS siren", () => {
  it("plays a loud continuous sweeping siren once and stops all sound when ended", () => {
    vi.stubGlobal("AudioContext", AudioMock);
    prepareSiren();
    expect(resume).toHaveBeenCalled();
    startSiren();
    startSiren();
    expect(oscillators).toHaveLength(2);
    expect(oscillators[0].type).toBe("sawtooth");
    expect(oscillators[0].frequency.value).toBe(950);
    expect(oscillators[1].frequency.value).toBe(1);
    expect(gains[0].gain.value).toBe(450);
    expect(gains[1].gain.value).toBe(0.8);
    for (const oscillator of oscillators) expect(oscillator.start).toHaveBeenCalledOnce();
    stopSiren();
    stopSiren();
    for (const oscillator of oscillators) expect(oscillator.stop).toHaveBeenCalledOnce();
  });
});