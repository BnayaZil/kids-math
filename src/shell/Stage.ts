import * as THREE from 'three';

/**
 * Owns the WebGL renderer, the shared camera and the canvas, and keeps them
 * sized to the window. Games render through it via render(scene).
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;

  width = 0;
  height = 0;

  private resizeListeners = new Set<(w: number, h: number) => void>();

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.canvas = this.renderer.domElement;
    container.appendChild(this.canvas);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    this.resetCamera();

    this.applySize();
    window.addEventListener('resize', this.applySize);
  }

  /** Put the camera back to the shell default. Called before each game starts. */
  resetCamera() {
    this.camera.position.set(0, 0, 6);
    this.camera.lookAt(0, 0, 0);
  }

  render(scene: THREE.Scene) {
    this.renderer.render(scene, this.camera);
  }

  /** Subscribe to resizes. Returns an unsubscribe function. */
  onResize(fn: (w: number, h: number) => void) {
    this.resizeListeners.add(fn);
    return () => this.resizeListeners.delete(fn);
  }

  private applySize = () => {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    for (const fn of this.resizeListeners) fn(this.width, this.height);
  };

  dispose() {
    window.removeEventListener('resize', this.applySize);
    this.resizeListeners.clear();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
