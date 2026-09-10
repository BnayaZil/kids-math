import type { GameDefinition } from '../shell/types';
import { createPlayground } from './playground';
import { createNumberHopper } from './number-hopper';

/**
 * THE GAME REGISTRY.
 *
 * To add a game:
 *   1. Create  src/games/<your-id>/index.ts  exporting a GameFactory.
 *   2. Import that factory above.
 *   3. Add ONE line to the array below.
 *
 * That is the whole contract — you touch only your own directory plus your one
 * line here, so two games can be built in parallel without colliding.
 *
 * A line with no `create` renders as a "coming soon" placeholder card. Turning
 * a placeholder into a real game = adding `create: <yourFactory>` to that line.
 */
export const games: GameDefinition[] = [
  { id: 'playground',    title: 'Playground',    grade: 'Demo',      color: '#ff6b6b', emoji: '🎡', create: createPlayground },
  { id: 'number-hopper', title: 'Number Hopper', grade: '2nd grade', color: '#4d96ff', emoji: '🐸', create: createNumberHopper },
  { id: 'cube-factory',  title: 'Cube Factory',  grade: '4th grade', color: '#6bcb77', emoji: '🧊' /* Seq 4 adds: create: createCubeFactory */ },
];
