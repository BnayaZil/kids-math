import type * as THREE from 'three';
import type { GameContext } from '../../shell/types';
import type { Hud } from './ui';
import type { Sounds } from './audio';
import type { OrbitView } from './view';

/**
 * What every level is handed, and what every level must provide.
 *
 * `input` is typed off GameContext rather than imported from the shell, so a
 * level still depends only on the published contract.
 */
export interface LevelKit {
  scene: THREE.Scene;
  input: GameContext['input'];
  hud: Hud;
  sounds: Sounds;
  view: OrbitView;
  /** Finished the whole level, with the stars earned (0-3). */
  onDone: (stars: number) => void;
}

export interface Level {
  update(dt: number): void;
  /** Only levels that re-lay-out on a resize need this; the camera handles itself. */
  resize?(): void;
  dispose(): void;
}

/**
 * Stars from mistakes, the same rule in all three levels: a clean run is three
 * stars, and nobody ever drops below one for finishing.
 */
export function starsFor(mistakes: number): number {
  if (mistakes === 0) return 3;
  if (mistakes <= 2) return 2;
  return 1;
}
