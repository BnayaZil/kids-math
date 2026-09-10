import * as THREE from 'three';

/**
 * The reward for landing exactly on the answer: a burst of stars.
 *
 * One Points cloud handles the whole burst — a few hundred separate meshes
 * would be a lot of draw calls for something that lasts a second and a half.
 * Particles share a single lifetime, which is plenty for confetti and keeps
 * the update loop to one pass.
 */

const COUNT = 160;
const LIFE = 1.6;
const GRAVITY = 9;

const COLORS = [0xffd93d, 0xff6b6b, 0x6bcb77, 0x4d96ff, 0xa66bff, 0xffffff];

/** A soft five-pointed star, drawn once and reused as the particle sprite. */
function makeStarTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (g) {
    const cx = size / 2;
    const cy = size / 2;
    const outer = size * 0.46;
    const inner = outer * 0.44;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      // Start at the top point rather than at 3 o'clock.
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fillStyle = '#ffffff';
    g.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

export interface Confetti {
  points: THREE.Points;
  /** Fire a burst centred on a world position. */
  burst(x: number, y: number, z: number): void;
  update(dt: number): void;
  dispose(): void;
}

export function createConfetti(): Confetti {
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const texture = makeStarTexture();
  const material = new THREE.PointsMaterial({
    map: texture,
    size: 0.55,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    // Confetti should never occlude the frog or punch holes in the road.
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.visible = false;
  // The cloud is positioned as a whole, so particle coordinates stay local.
  points.frustumCulled = false;

  let age = LIFE;
  const color = new THREE.Color();

  return {
    points,

    burst(x, y, z) {
      points.position.set(x, y, z);
      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3;
        positions[i3] = 0;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = 0;

        // Upward cone: mostly up, spread sideways, a little towards the camera.
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 5;
        const up = 4.5 + Math.random() * 4.5;
        velocities[i3] = Math.cos(angle) * speed * 0.55;
        velocities[i3 + 1] = up;
        velocities[i3 + 2] = Math.sin(angle) * speed * 0.35;

        color.setHex(COLORS[Math.floor(Math.random() * COLORS.length)]);
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      age = 0;
      points.visible = true;
      material.opacity = 1;
    },

    update(dt) {
      if (age >= LIFE) return;
      age += dt;
      if (age >= LIFE) {
        points.visible = false;
        return;
      }
      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3;
        velocities[i3 + 1] -= GRAVITY * dt;
        positions[i3] += velocities[i3] * dt;
        positions[i3 + 1] += velocities[i3 + 1] * dt;
        positions[i3 + 2] += velocities[i3 + 2] * dt;
      }
      geometry.attributes.position.needsUpdate = true;
      // Hold full brightness, then fade over the last third.
      const fadeFrom = LIFE * 0.6;
      material.opacity = age < fadeFrom ? 1 : 1 - (age - fadeFrom) / (LIFE - fadeFrom);
    },

    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
