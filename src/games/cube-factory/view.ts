import * as THREE from 'three';

/**
 * Frames the factory floor and sways gently around it, so a slab of cubes
 * reads as a solid object instead of a flat picture.
 *
 * The HUD eats a band at the top (question) and another at the bottom (number
 * pad), and those bands change size as the game runs — a tall 19x6 problem with
 * the pad up has far less room than a 3x3 with no controls. So the caller
 * measures the real bands from the DOM and hands them over here; the camera
 * fits the cubes into what is actually left and centres them in that gap.
 * Guessing a fixed margin instead is what let the pad cover the cubes.
 */
const MARGIN = 1.12;

export class OrbitView {
  private readonly target = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private contentWidth = 10;
  private contentHeight = 10;
  private topBand = 0.22;
  private bottomBand = 0.28;
  private distance = 14;
  private time = 0;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  /** Frame a content box of `width` x `height` world units centred on `center`. */
  frame(width: number, height: number, center: THREE.Vector3 = new THREE.Vector3()) {
    this.contentWidth = Math.max(1, width);
    this.contentHeight = Math.max(1, height);
    this.center.copy(center);
    this.recompute();
  }

  /**
   * How much of the screen the HUD covers, top and bottom, as fractions of the
   * viewport height.
   */
  setBands(top: number, bottom: number) {
    const clamp = (v: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(0, v)) : 0);
    const nextTop = clamp(top, 0.45);
    const nextBottom = clamp(bottom, 0.55);
    if (Math.abs(nextTop - this.topBand) < 0.005 && Math.abs(nextBottom - this.bottomBand) < 0.005) {
      return;
    }
    this.topBand = nextTop;
    this.bottomBand = nextBottom;
    this.recompute();
  }

  /** The camera aspect changed; the framing distance changes with it. */
  resize() {
    this.recompute();
  }

  update(dt: number) {
    this.time += dt;
    const yaw = Math.sin(this.time * 0.24) * 0.34;
    const pitch = 0.2 + Math.sin(this.time * 0.17) * 0.06;
    const flat = Math.cos(pitch) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(yaw) * flat,
      this.target.y + Math.sin(pitch) * this.distance,
      this.target.z + Math.cos(yaw) * flat,
    );
    this.camera.lookAt(this.target);
  }

  private recompute() {
    const verticalFov = (this.camera.fov * Math.PI) / 180;
    const tanHalf = Math.tan(verticalFov / 2);

    // The slice of screen height the cubes may actually use.
    const free = Math.max(0.25, 1 - this.topBand - this.bottomBand);

    const forHeight = (this.contentHeight * MARGIN) / (2 * tanHalf * free);
    const horizontalFov = 2 * Math.atan(tanHalf * this.camera.aspect);
    const forWidth = (this.contentWidth * MARGIN) / (2 * Math.tan(horizontalFov / 2));
    // The floor stops a 2x2 array from filling the screen; too high a floor
    // leaves small arrays looking lost in the middle of it.
    this.distance = Math.max(4.5, forHeight, forWidth);

    // Slide the aim so the cubes land in the middle of the free band rather
    // than the middle of the screen.
    const visibleWorldHeight = 2 * this.distance * tanHalf;
    this.target.copy(this.center);
    this.target.y += ((this.topBand - this.bottomBand) / 2) * visibleWorldHeight;
  }
}
