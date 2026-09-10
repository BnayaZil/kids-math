import * as THREE from 'three';
import type { GameContext, GameInstance } from '../../shell/types';

/**
 * Playground — a tiny demo, NOT a real math game.
 *
 * Three spinning shapes you can tap to recolor and kick into a faster spin.
 * Its only job is to prove the shell + registry + menu work end to end.
 * The real games (Number Hopper, Cube Factory) are separate tasks.
 */
export function createPlayground(ctx: GameContext): GameInstance {
  const { scene, input, overlay } = ctx;

  scene.background = new THREE.Color('#0b1026');

  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(3, 4, 5);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const palette = [0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xa66bff];
  const makeMat = (color: number) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 });

  const shapes: THREE.Mesh[] = [
    new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), makeMat(0xff6b6b)),
    new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), makeMat(0xffd93d)),
    new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.28, 16, 40), makeMat(0x4d96ff)),
  ];
  shapes[0].position.x = -2.4;
  shapes[2].position.x = 2.4;
  shapes.forEach((s) => scene.add(s));

  // Per-shape spin speed (rad/s). A tap bumps the y-spin, which eases back down.
  const spinY = shapes.map(() => 0.6);

  const recolor = (mesh: THREE.Mesh) =>
    (mesh.material as THREE.MeshStandardMaterial).color.setHex(
      palette[Math.floor(Math.random() * palette.length)],
    );

  const untap = input.onTap((e) => {
    const hit = input.pick(e, shapes);
    if (!hit) return;
    const idx = shapes.indexOf(hit.object as THREE.Mesh);
    if (idx === -1) return;
    recolor(shapes[idx]);
    spinY[idx] += 4;
  });

  // A DOM control in the shell's overlay — proves the overlay contract works
  // (shell creates it, controls opt back into pointer events, shell empties it).
  const button = document.createElement('button');
  button.className = 'pg-button';
  button.textContent = '🎨 Shuffle colors';
  button.addEventListener('click', () => {
    shapes.forEach((s) => {
      recolor(s);
      spinY[shapes.indexOf(s)] += 4;
    });
  });
  overlay.appendChild(button);

  return {
    update(dt) {
      shapes.forEach((s, i) => {
        s.rotation.x += 0.4 * dt;
        s.rotation.y += spinY[i] * dt;
        spinY[i] += (0.6 - spinY[i]) * Math.min(dt * 2, 1); // ease back to base
      });
    },
    dispose() {
      untap();
      // Geometries and materials are freed by the host's scene sweep.
    },
  };
}
