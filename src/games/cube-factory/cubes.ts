import * as THREE from 'three';
import { CELL, CUBE_SIZE } from './theme';
import { clamp01, easeOutBack } from './anim';

/** How far above its resting place a cube starts, in world units. */
const DROP_HEIGHT = 4;

const scratch = new THREE.Vector3();

/**
 * A rows x cols slab of unit cubes that drops into place in a diagonal wave.
 *
 * It is a single InstancedMesh, so even the 20x30 block of a 13 x 24 problem
 * (600 cubes) costs one draw call. The local origin is the slab's bottom-left
 * corner, which is what lets the area model lay four of them out on a grid
 * without any coordinate gymnastics.
 */
export class CubeBlock {
  readonly object: THREE.InstancedMesh;
  readonly rows: number;
  readonly cols: number;

  private readonly delays: number[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly duration = 0.42;
  private readonly totalTime: number;
  private time = 0;
  private settled = false;

  constructor(
    rows: number,
    cols: number,
    color: number,
    opts: { stagger?: number; startFilled?: boolean } = {},
  ) {
    this.rows = rows;
    this.cols = cols;

    const stagger = opts.stagger ?? 0.035;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.05 });
    this.object = new THREE.InstancedMesh(geometry, material, Math.max(1, rows * cols));
    // The instances move, so the bounds computed at build time would be wrong.
    this.object.frustumCulled = false;

    let longest = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const delay = (r + c) * stagger;
        this.delays.push(delay);
        if (delay > longest) longest = delay;
      }
    }
    this.totalTime = longest + this.duration;

    if (opts.startFilled) this.settle();
    else this.paint(0);
  }

  /** Slab size in world units. */
  get width(): number {
    return this.cols * CELL;
  }

  get height(): number {
    return this.rows * CELL;
  }

  get finished(): boolean {
    return this.settled;
  }

  update(dt: number) {
    if (this.settled) return;
    this.time += dt;
    this.paint(this.time);
    if (this.time >= this.totalTime) this.settled = true;
  }

  /** Jump straight to the finished state, no animation. */
  settle() {
    this.time = this.totalTime;
    this.paint(this.time);
    this.settled = true;
  }

  private paint(time: number) {
    for (let i = 0; i < this.delays.length; i++) {
      const progress = clamp01((time - this.delays[i]) / this.duration);
      const eased = easeOutBack(progress);
      const row = Math.floor(i / this.cols);
      const col = i % this.cols;
      scratch.set(col * CELL + CELL / 2, row * CELL + CELL / 2, 0);
      this.dummy.position.set(scratch.x, scratch.y + (1 - eased) * DROP_HEIGHT, scratch.z);
      // easeOutBack dips below zero for an instant; a zero-scale matrix is
      // degenerate, so never let it reach it.
      const size = Math.max(0.0001, eased) * CUBE_SIZE;
      this.dummy.scale.set(size, size, size);
      this.dummy.updateMatrix();
      this.object.setMatrixAt(i, this.dummy.matrix);
    }
    this.object.instanceMatrix.needsUpdate = true;
  }
}

/** The empty grid still waiting to be filled. Origin is the bottom-left corner. */
export function makeGridOutline(rows: number, cols: number, color: number): THREE.LineSegments {
  const points: number[] = [];
  for (let r = 0; r <= rows; r++) {
    points.push(0, r * CELL, 0, cols * CELL, r * CELL, 0);
  }
  for (let c = 0; c <= cols; c++) {
    points.push(c * CELL, 0, 0, c * CELL, rows * CELL, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 });
  return new THREE.LineSegments(geometry, material);
}

/**
 * A flat translucent rectangle, origin at its bottom-left corner.
 *
 * `glow` switches to additive blending: over the dark background a plain 30%
 * yellow panel comes out a muddy olive, which is no use at all when the game
 * has just told the kid to "tap the glowing row".
 */
export function makePanel(
  width: number,
  height: number,
  color: number,
  opacity: number,
  glow = false,
): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(width, height);
  geometry.translate(width / 2, height / 2, 0);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  return new THREE.Mesh(geometry, material);
}

/**
 * A number or label drawn onto a canvas and hung in the scene as a sprite.
 *
 * Sprites always face the camera, so a label stays readable while the camera
 * sways — and it needs no font file, which the project rules out anyway.
 */
export function makeLabel(
  text: string,
  opts: { color?: string; background?: string; height?: number; maxWidth?: number } = {},
): THREE.Sprite {
  const color = opts.color ?? '#ffffff';
  const background = opts.background ?? 'rgba(0,0,0,0.55)';
  const worldHeight = opts.height ?? 0.9;

  const fontSize = 96;
  const padX = 34;
  const padY = 18;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = `900 ${fontSize}px 'Comic Sans MS', 'Trebuchet MS', system-ui, sans-serif`;

  let textWidth = text.length * fontSize * 0.6;
  if (ctx) {
    ctx.font = font;
    textWidth = ctx.measureText(text).width;
  }
  canvas.width = Math.ceil(textWidth + padX * 2);
  canvas.height = Math.ceil(fontSize + padY * 2);

  if (ctx) {
    // Sizing the canvas resets the context, so every setting is applied again.
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = background;
    roundedRect(ctx, 0, 0, canvas.width, canvas.height, 26);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  // Never let a label grow wider than the block it names, or neighbouring
  // labels overlap and hide each other's digits.
  const aspect = canvas.width / canvas.height;
  const height =
    opts.maxWidth && aspect * worldHeight > opts.maxWidth
      ? opts.maxWidth / aspect
      : worldHeight;
  sprite.scale.set(aspect * height, height, 1);
  // Labels sit in front of the cubes they describe.
  sprite.renderOrder = 10;
  return sprite;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function addLights(scene: THREE.Scene) {
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 7, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc4ff, 0.85);
  fill.position.set(-6, -3, 5);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
}

/**
 * Free everything under `root` and unhook it from the scene.
 *
 * The shell sweeps geometries and materials on exit but not canvas textures,
 * and this game makes one per label — so it releases those too.
 */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    const drawable = obj as Partial<THREE.Mesh>;
    drawable.geometry?.dispose?.();
    const material = drawable.material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const mat of materials) {
      (mat as THREE.Material & { map?: THREE.Texture | null }).map?.dispose();
      mat.dispose();
    }
  });
  root.removeFromParent();
}
