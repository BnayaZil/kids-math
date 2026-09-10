/**
 * All sound is synthesised with the Web Audio API — short blips built from an
 * oscillator and a volume ramp. The project ships no audio files on purpose,
 * and a browser that blocks audio should cost the player nothing, so every
 * call here fails silently.
 *
 * The AudioContext is created lazily on the first hop, because browsers refuse
 * to start one before the page has been touched.
 */

let ctx: AudioContext | null = null;
let broken = false;

function audio(): AudioContext | null {
  if (broken) return null;
  try {
    ctx ??= new AudioContext();
    // A context can be born suspended if the gesture was not trusted.
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    broken = true;
    return null;
  }
}

/** One short note. `at` is an offset in seconds, for building little tunes. */
function note(freq: number, at: number, length: number, gain = 0.15, type: OscillatorType = 'triangle') {
  const ac = audio();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const vol = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ac.currentTime + at;
    // Ramp in and out: a square-edged note clicks.
    vol.gain.setValueAtTime(0, t0);
    vol.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    vol.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
    osc.connect(vol).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + length + 0.02);
  } catch {
    // Ignore: sound is decoration, never a dependency.
  }
}

/** A one-step hop: a little rising "boing". */
export function playHopSmall() {
  note(440, 0, 0.14, 0.12);
  note(660, 0.05, 0.12, 0.1);
}

/** A ten-step hop: lower, longer, more air under it. */
export function playHopBig() {
  note(300, 0, 0.24, 0.14);
  note(520, 0.1, 0.2, 0.12);
}

/** Landed on the answer: a bright little fanfare. */
export function playWin() {
  const tune = [523, 659, 784, 1047];
  tune.forEach((f, i) => note(f, i * 0.11, 0.3, 0.16));
}

/** Went too far. Soft and low — a nudge, never a buzzer. */
export function playOvershoot() {
  note(320, 0, 0.18, 0.1, 'sine');
  note(240, 0.09, 0.22, 0.09, 'sine');
}

/** Tried to hop off the end of the road. Barely there. */
export function playBlocked() {
  note(200, 0, 0.12, 0.07, 'sine');
}

/** Finished a whole level. */
export function playLevelComplete() {
  const tune = [523, 659, 784, 1047, 784, 1047, 1319];
  tune.forEach((f, i) => note(f, i * 0.12, 0.34, 0.16));
}

/** Drop the AudioContext when the game exits so it stops holding the device. */
export function disposeSound() {
  try {
    void ctx?.close();
  } catch {
    // Already closed or never opened.
  }
  ctx = null;
}
