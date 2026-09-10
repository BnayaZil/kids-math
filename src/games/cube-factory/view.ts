import * as THREE from 'three';

/**
 * Frames the factory floor and sways gently around it, so a slab of cubes
 * reads as a solid object instead of a flat picture.
 *
 * The HUD covers a band at the top and another at the bottom, so the vertical
 * fit is deliberately loose and the content sits a little above centre.
 */
const WIDTH_MARGIN = 1.3;
const HEIGHT_MARGIN = 1.95;

export class OrbitView {
  private readonly target = new THREE.Vector3();
  private contentWidth = 10;
  private contentHeight = 10;
  private distance = 14;
  private time = 0;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  /** Frame a content box of `width` x `height` world units centred on `center`. */
  frame(width: number, height: number, center: THREE.Vector3 = new THREE.Vector3()) {
    this.contentWidth = Math.max(1, width);
    this.contentHeight = Math.max(1, height);
    this.target.copy(center);
    // Aim slightly low so the cubes ride above the number pad.
    this.target.y -= this.contentHeight * 0.06 + 0.3;
    this.distance = this.fitDistance();
  }

  /** The camera aspect has changed; the framing distance changes with it. */
  resize() {
    this.distance = this.fitDistance();
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

  private fitDistance(): number {
    const verticalFov = (this.camera.fov * Math.PI) / 180;
    const forHeight = (this.contentHeight * HEIGHT_MARGIN) / (2 * Math.tan(verticalFov / 2));
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
    const forWidth = (this.contentWidth * WIDTH_MARGIN) / (2 * Math.tan(horizontalFov / 2));
    return Math.max(7, forHeight, forWidth);
  }
}
