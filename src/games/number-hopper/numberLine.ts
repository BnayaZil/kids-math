import * as THREE from 'three';
import { makeLabel, type Label } from './label';
import { MAX, MIN } from './levels';

/**
 * The road: one world unit per number, so the distance the frog travels IS the
 * arithmetic. A +10 hop is literally ten times the length of a +1 hop, which
 * is the whole point of the game and the reason nothing here is to scale-fudge.
 *
 * Ticks come in three heights — every 1, taller every 5, tallest every 10 —
 * because that rhythm is what lets a child count along the line without
 * reading a number on every square.
 */

/** How far the road extends past 0 and 100, so the ends do not look cut off. */
const OVERHANG = 2;
const ROAD_WIDTH = 3.6;

export interface NumberLine {
  group: THREE.Group;
  dispose(): void;
}

/** Marks that a number is a multiple of ten, five, or neither. */
function tickClass(n: number): 'ten' | 'five' | 'one' {
  if (n % 10 === 0) return 'ten';
  if (n % 5 === 0) return 'five';
  return 'one';
}

export function createNumberLine(): NumberLine {
  const group = new THREE.Group();
  const labels: Label[] = [];
  // Geometries and materials made here are shared between meshes, so they are
  // tracked and freed explicitly rather than relying on a per-mesh sweep.
  const owned: Array<{ dispose(): void }> = [];

  function own<T extends { dispose(): void }>(thing: T): T {
    owned.push(thing);
    return thing;
  }

  const length = MAX - MIN + OVERHANG * 2;
  const midX = (MIN + MAX) / 2;

  // ---- the road ----------------------------------------------------------
  const roadGeo = own(new THREE.BoxGeometry(length, 0.4, ROAD_WIDTH));
  const roadMat = own(
    new THREE.MeshStandardMaterial({ color: 0xf6e3c0, roughness: 0.85 }),
  );
  const road = new THREE.Mesh(roadGeo, roadMat);
  // Top face sits exactly on y = 0, so everything else can be placed at 0.
  road.position.set(midX, -0.2, 0);
  group.add(road);

  // ---- ground ------------------------------------------------------------
  // One slab, far bigger than the view, running under the road and out past
  // the fog. Two narrow strips either side left a hard grass/sky seam across
  // the middle of the screen that read as a wall.
  const grassGeo = own(new THREE.BoxGeometry(length + 160, 0.3, 300));
  const grassMat = own(
    new THREE.MeshStandardMaterial({ color: 0x7cc576, roughness: 1 }),
  );
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.position.set(midX, -0.36, 0);
  group.add(grass);

  // ---- ticks -------------------------------------------------------------
  // One InstancedMesh per tick class: 101 ticks as separate meshes would be
  // 101 draw calls for what is really three shapes repeated.
  // Wide and shallow, not narrow and deep: seen from a low camera, a tick that
  // reaches far across the road foreshortens into a diagonal slash, and a
  // hundred of those read as hatching rather than as counting marks.
  const tickSpecs = {
    one: { w: 0.17, d: ROAD_WIDTH * 0.15, color: 0xd8bc93 },
    five: { w: 0.21, d: ROAD_WIDTH * 0.34, color: 0xab8555 },
    ten: { w: 0.3, d: ROAD_WIDTH * 0.95, color: 0x6b4f2a },
  } as const;

  const byClass: Record<'one' | 'five' | 'ten', number[]> = { one: [], five: [], ten: [] };
  for (let n = MIN; n <= MAX; n++) byClass[tickClass(n)].push(n);

  const matrix = new THREE.Matrix4();
  for (const key of ['one', 'five', 'ten'] as const) {
    const numbers = byClass[key];
    const spec = tickSpecs[key];
    const geo = own(new THREE.BoxGeometry(spec.w, 0.06, spec.d));
    const mat = own(new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.9 }));
    const mesh = new THREE.InstancedMesh(geo, mat, numbers.length);
    numbers.forEach((n, i) => {
      matrix.makeTranslation(n, 0.02, 0);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  // ---- signposts every ten ----------------------------------------------
  // Only multiples of ten get a number. Labelling all 101 would be a wall of
  // digits; the frog carries its own current number instead.
  // Kept low and set back from the road: at head height they collided on
  // screen with the number floating above the frog, which is the one label
  // the child actually needs to read.
  const POST_Z = -ROAD_WIDTH / 2 - 1.4;
  const postGeo = own(new THREE.BoxGeometry(0.16, 1.15, 0.16));
  const postMat = own(new THREE.MeshStandardMaterial({ color: 0x8b5e34, roughness: 0.9 }));
  for (let n = MIN; n <= MAX; n += 10) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(n, 0.58, POST_Z);
    group.add(post);

    const label = makeLabel(String(n), {
      size: 1.05,
      color: '#2b2b3a',
      background: '#ffffff',
    });
    label.sprite.position.set(n, 1.45, POST_Z);
    group.add(label.sprite);
    labels.push(label);
  }

  return {
    group,
    dispose() {
      labels.forEach((l) => l.dispose());
      owned.forEach((o) => o.dispose());
    },
  };
}
