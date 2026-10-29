// Synthesized locally so SOS sound does not depend on a download or connection.
let context: AudioContext | null = null;
let stopSound: (() => void) | null = null;

export function prepareSiren() {
  try {
    if (!context || context.state === "closed") {
      const Audio = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Audio) return null;
      context = new Audio();
    }
    if (context.state === "suspended") void context.resume().catch(() => {});
    return context;
  } catch {
    return null;
  }
}

export function startSiren() {
  if (stopSound) return;
  const ctx = prepareSiren();
  if (!ctx) return;
  try {
    const tone = ctx.createOscillator();
    const sweep = ctx.createOscillator();
    const depth = ctx.createGain();
    const volume = ctx.createGain();
    tone.type = "sawtooth";
    tone.frequency.value = 950;
    sweep.type = "triangle";
    sweep.frequency.value = 1;
    depth.gain.value = 450;
    volume.gain.value = 0.8;
    sweep.connect(depth);
    depth.connect(tone.frequency);
    tone.connect(volume);
    volume.connect(ctx.destination);
    tone.start();
    sweep.start();
    stopSound = () => {
      tone.stop();
      sweep.stop();
      tone.disconnect();
      sweep.disconnect();
      depth.disconnect();
      volume.disconnect();
    };
  } catch {
    // Sound availability must never prevent emergency messages or tracking.
  }
}

export function stopSiren() {
  stopSound?.();
  stopSound = null;
}