import * as THREE from 'three';
import { makeLabel } from './label';

/**
 * The frog: spheres and boxes only, no model files.
 *
 * It faces the camera rather than the direction of travel, so a child always
 * sees its eyes, and only turns its shoulders slightly towards the hop. The
 * number it is standing on rides above its head — that readout, not the road
 * labels, is what the child actually reads while playing.
 */

/** Arc height in world units for a hop of `distance` numbers. */
function arcHeight(distance: number): number {
  // Square root, not linear: a +10 hop must look like a big leap without
  // flying off the top of the screen.
  return 0.55 + Math.sqrt(distance) * 0.62;
}

/** Seconds a hop of `distance` numbers takes. */
function hopDuration(distance: number): number {
  return 0.3 + Math.sqrt(distance) * 0.1;
}

export interface Frog {
  group: THREE.Group;
  /** The number the frog is standing on. */
  readonly value: number;
  readonly isHopping: boolean;
  /** Put the frog down on a number with no animation. */
  placeAt(n: number): void;
  /** Hop to a number, calling `onLand` when it touches down. */
  hopTo(n: number, onLand?: () => void): void;
  /** Refuse-to-move shake, for a hop that would leave the road. */
  shake(): void;
  update(dt: number, elapsed: number): void;
  dispose(): void;
}

/**
 * Base size of the character. The squash-and-stretch animation writes
 * `body.scale` directly and has to stay centred on 1.0, so the base size lives
 * on a separate rig between the frog and its animated body.
 */
const FROG_SCALE = 1.35;

export function createFrog(): Frog {
  const group = new THREE.Group();
  /** Carries the base size only; never animated. */
  const rig = new THREE.Group();
  rig.scale.setScalar(FROG_SCALE);
  group.add(rig);
  /** Child of `rig`; holds the squash and hop-arc transforms. */
  const body = new THREE.Group();
  rig.add(body);

  const owned: Array<{ dispose(): void }> = [];
  function own<T extends { dispose(): void }>(thing: T): T {
    owned.push(thing);
    return thing;
  }

  const skin = own(new THREE.MeshStandardMaterial({ color: 0x5fc75f, roughness: 0.5 }));
  const belly = own(new THREE.MeshStandardMaterial({ color: 0xd7f5b1, roughness: 0.6 }));
  const white = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
  const black = own(new THREE.MeshStandardMaterial({ color: 0x1c1c26, roughness: 0.25 }));

  const sphere = own(new THREE.SphereGeometry(1, 20, 14));

  // Torso: a squashed sphere, so the frog reads as a friendly blob.
  const torso = new THREE.Mesh(sphere, skin);
  torso.scale.set(0.62, 0.5, 0.56);
  torso.position.y = 0.5;
  body.add(torso);

  const tummy = new THREE.Mesh(sphere, belly);
  tummy.scale.set(0.44, 0.34, 0.3);
  tummy.position.set(0, 0.42, 0.34);
  body.add(tummy);

  // Eyes sit high and wide — the single biggest lever on how cute this looks.
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(sphere, white);
    eye.scale.setScalar(0.23);
    eye.position.set(side * 0.29, 0.93, 0.16);
    body.add(eye);

    const pupil = new THREE.Mesh(sphere, black);
    pupil.scale.setScalar(0.115);
    pupil.position.set(side * 0.31, 0.93, 0.33);
    body.add(pupil);
  }

  // Back legs, folded, and two little front feet.
  const legGeo = own(new THREE.CapsuleGeometry(0.11, 0.3, 4, 8));
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, skin);
    leg.position.set(side * 0.42, 0.24, -0.1);
    leg.rotation.z = side * 0.9;
    body.add(leg);

    const foot = new THREE.Mesh(sphere, skin);
    foot.scale.set(0.16, 0.07, 0.2);
    foot.position.set(side * 0.24, 0.05, 0.3);
    body.add(foot);
  }

  // The number the frog is on, floating above its head. Kept outside the rig
  // so the frog's size does not change how big the number reads.
  const READOUT_REST_Y = 2.9;
  const readout = makeLabel('0', { size: 1.15, color: '#1b3a6b', background: '#ffffff' });
  readout.sprite.position.set(0, READOUT_REST_Y, 0);
  group.add(readout.sprite);

  let value = 0;
  let hopping = false;
  let from = 0;
  let to = 0;
  let elapsedInHop = 0;
  let duration = 0;
  let landed: (() => void) | undefined;
  let shakeLeft = 0;

  function setValue(n: number) {
    value = n;
    readout.setText(String(n));
  }

  return {
    group,
    get value() {
      return value;
    },
    get isHopping() {
      return hopping;
    },

    placeAt(n: number) {
      hopping = false;
      landed = undefined;
      setValue(n);
      group.position.x = n;
      body.position.y = 0;
      body.scale.set(1, 1, 1);
      group.rotation.y = 0;
      readout.sprite.position.y = READOUT_REST_Y;
    },

    hopTo(n: number, onLand?: () => void) {
      from = value;
      to = n;
      duration = hopDuration(Math.abs(n - from));
      elapsedInHop = 0;
      hopping = true;
      landed = onLand;
      // Turn the shoulders towards the hop without losing the face.
      group.rotation.y = n > from ? -0.34 : 0.34;
      // The readout flips to the destination the moment the frog commits, so
      // the number and the landing arrive together.
      setValue(n);
    },

    shake() {
      shakeLeft = 0.32;
    },

    update(dt, elapsed) {
      if (hopping) {
        elapsedInHop += dt;
        const t = Math.min(elapsedInHop / duration, 1);
        const distance = Math.abs(to - from);

        group.position.x = from + (to - from) * t;
        // Parabola: 0 at both ends, peak at the middle.
        body.position.y = arcHeight(distance) * 4 * t * (1 - t);

        // Stretch upwards mid-flight, squash flat on touchdown.
        const stretch = Math.sin(Math.PI * t);
        const squash = t > 0.88 ? (t - 0.88) / 0.12 : 0;
        body.scale.set(
          1 - 0.12 * stretch + 0.18 * squash,
          1 + 0.2 * stretch - 0.26 * squash,
          1 - 0.12 * stretch + 0.18 * squash,
        );

        // The number rides with the frog instead of being flown over.
        readout.sprite.position.y = READOUT_REST_Y + body.position.y * FROG_SCALE;

        if (t >= 1) {
          hopping = false;
          group.position.x = to;
          body.position.y = 0;
          readout.sprite.position.y = READOUT_REST_Y;
          const done = landed;
          landed = undefined;
          done?.();
        }
        return;
      }

      // Idle: breathe, and unwind any turn from the last hop.
      const bob = Math.sin(elapsed * 2.6) * 0.035;
      body.position.y = bob;
      body.scale.set(1 - bob * 0.4, 1 + bob * 0.5, 1 - bob * 0.4);
      group.rotation.y *= Math.max(0, 1 - dt * 5);

      if (shakeLeft > 0) {
        shakeLeft = Math.max(0, shakeLeft - dt);
        // Fast, small, and decaying — a "nope", not a crash.
        group.position.x = value + Math.sin(shakeLeft * 60) * shakeLeft * 0.35;
        if (shakeLeft === 0) group.position.x = value;
      }
    },

    dispose() {
      readout.dispose();
      owned.forEach((o) => o.dispose());
    },
  };
}
