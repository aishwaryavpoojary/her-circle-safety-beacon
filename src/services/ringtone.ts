// Ringtone generated with Web Audio — no network, no files.
export function startRingtone(volume: number, tones: 2 | 3) {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  const freqs = tones === 2 ? [480, 620] : [523, 659, 784];
  const oscs = freqs.map((f) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(gain);
    o.start();
    return o;
  });
  const v = Math.max(0, Math.min(1, volume)) * 0.35;
  // Ring pattern: 1s on/0.25 off/1s on, then 2s pause
  const schedule = () => {
    const t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const s = t + i * 1.25;
      gain.gain.setValueAtTime(v, s);
      gain.gain.setValueAtTime(0, s + 1);
    }
  };
  schedule();
  const id = setInterval(schedule, 4500);
  return () => {
    clearInterval(id);
    oscs.forEach((o) => o.stop());
    void ctx.close();
  };
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
