/**
 * Cheerful noises, synthesised on the spot.
 *
 * The project allows no audio files, so every sound here is a few oscillators.
 * Browsers refuse to start audio until the user has tapped something, so the
 * context is created lazily from inside tap handlers and resumed if suspended.
 */
export class Sounds {
  private ctx: AudioContext | null = null;
  private failed = false;

  /** Short rising blip — a cube landing on the grid. */
  snap() {
    this.blip([440, 660], 0.09, 'square', 0.1);
  }

  /** A softer tick for menu taps and steppers. */
  tick() {
    this.blip([520], 0.06, 'triangle', 0.08);
  }

  /** Rising major arpeggio — a right answer. */
  correct() {
    this.blip([523, 659, 784], 0.12, 'triangle', 0.14);
  }

  /** Two low, gentle notes. Never harsh: a wrong answer is not a punishment. */
  wrong() {
    this.blip([300, 240], 0.14, 'sine', 0.12);
  }

  /** The level-complete run. */
  fanfare() {
    this.blip([523, 659, 784, 1047, 1319], 0.13, 'triangle', 0.16);
  }

  dispose() {
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  /** Play `notes` one after another, each lasting `step` seconds. */
  private blip(notes: number[], step: number, type: OscillatorType, gain: number) {
    const ctx = this.context();
    if (!ctx) return;
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * step;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      // A quick attack and a smooth tail, so nothing clicks.
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + step * 1.6);
      osc.connect(amp).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + step * 1.8);
    });
  }

  private context(): AudioContext | null {
    if (this.failed) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        this.failed = true;
        return null;
      }
      try {
        this.ctx = new Ctor();
      } catch {
        this.failed = true;
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }
}
