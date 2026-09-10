/** A requestAnimationFrame loop with a single per-frame update hook. */
export class GameLoop {
  private rafId = 0;
  private running = false;
  private last = 0;
  private startTime = 0;
  private frame: (dt: number, elapsed: number) => void = () => {};

  /** Set the callback run once per frame. dt/elapsed are in seconds. */
  setFrame(fn: (dt: number, elapsed: number) => void) {
    this.frame = fn;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.startTime = this.last;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (now: number) => {
    if (!this.running) return;
    // Clamp big gaps (e.g. after a tab switch) so nothing jumps.
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    const elapsed = (now - this.startTime) / 1000;
    this.frame(dt, elapsed);
    this.rafId = requestAnimationFrame(this.tick);
  };
}
