import * as THREE from 'three';

export interface TapEvent {
  /** Normalized device coords, -1..1, y up — ready for raycasting. */
  ndc: THREE.Vector2;
  /** CSS pixel position within the canvas. */
  x: number;
  y: number;
}

/**
 * Pointer + touch helper. Reports taps (a press that isn't a drag) as
 * normalized coords, and raycasts them against objects for you via pick().
 * One instance lives for the whole app; games just subscribe with onTap().
 */
export class Input {
  private raycaster = new THREE.Raycaster();
  private tapListeners = new Set<(e: TapEvent) => void>();
  private downX = 0;
  private downY = 0;

  constructor(
    private element: HTMLElement,
    private camera: THREE.Camera,
  ) {
    element.addEventListener('pointerdown', this.onDown);
    element.addEventListener('pointerup', this.onUp);
  }

  /** Subscribe to taps. Returns an unsubscribe function. */
  onTap(fn: (e: TapEvent) => void) {
    this.tapListeners.add(fn);
    return () => this.tapListeners.delete(fn);
  }

  /** Raycast a tap against objects; returns the closest hit or null. */
  pick(e: TapEvent, objects: THREE.Object3D[]): THREE.Intersection | null {
    this.raycaster.setFromCamera(e.ndc, this.camera);
    return this.raycaster.intersectObjects(objects, true)[0] ?? null;
  }

  private onDown = (ev: PointerEvent) => {
    this.downX = ev.clientX;
    this.downY = ev.clientY;
  };

  private onUp = (ev: PointerEvent) => {
    // A drag (moved more than 10px) is not a tap.
    if (Math.hypot(ev.clientX - this.downX, ev.clientY - this.downY) > 10) return;
    const rect = this.element.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const ndc = new THREE.Vector2(
      (x / rect.width) * 2 - 1,
      -(y / rect.height) * 2 + 1,
    );
    for (const fn of this.tapListeners) fn({ ndc, x, y });
  };

  dispose() {
    this.element.removeEventListener('pointerdown', this.onDown);
    this.element.removeEventListener('pointerup', this.onUp);
    this.tapListeners.clear();
  }
}
