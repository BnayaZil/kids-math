/** Easing curves and a small tween runner the levels step from update(). */

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Shoots past the target and settles back — the chunky "snap" feel. */
export function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const t = x - 1;
  return 1 + c3 * t * t * t + c1 * t * t;
}

export function easeOutCubic(x: number): number {
  return 1 - (1 - x) ** 3;
}

export function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

interface Tween {
  elapsed: number;
  duration: number;
  onUpdate: (progress: number) => void;
  onDone?: () => void;
}

/**
 * Time-based tweens. A level adds one, steps it every frame, and checks `busy`
 * to hold off taps while the factory is still moving.
 */
export class Tweens {
  private items: Tween[] = [];

  add(duration: number, onUpdate: (progress: number) => void, onDone?: () => void) {
    onUpdate(0);
    this.items.push({ elapsed: 0, duration, onUpdate, onDone });
  }

  /** True while anything is still moving. */
  get busy(): boolean {
    return this.items.length > 0;
  }

  update(dt: number) {
    if (this.items.length === 0) return;
    const running = this.items;
    // Swap the list first: an onDone that starts another tween appends to the
    // new list rather than to one being iterated.
    this.items = [];
    for (const tween of running) {
      tween.elapsed += dt;
      const progress = clamp01(tween.elapsed / tween.duration);
      tween.onUpdate(progress);
      if (progress < 1) this.items.push(tween);
      else tween.onDone?.();
    }
  }

  clear() {
    this.items = [];
  }
}
