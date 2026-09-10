import type * as THREE from 'three';
import type { Input } from './Input';

/**
 * The shell/game contract. A game NEVER imports the shell's concrete classes —
 * it only depends on these types. That is what lets games be built in parallel:
 * the shell owns the renderer, camera, loop and input; the game just fills a
 * scene and animates it.
 */

/** What the shell hands a game when it starts. */
export interface GameContext {
  /** A fresh, empty scene. Add your objects here. */
  scene: THREE.Scene;
  /** Perspective camera, framed on the origin. Move it however you like. */
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** Pointer/touch helper: taps as normalized coords + a raycast pick(). */
  input: Input;
  /**
   * A DOM layer the shell creates for this game, sitting above the canvas and
   * below the back button. Append your HTML UI here (number pads, buttons).
   * The shell empties it automatically when the game exits.
   *
   * The layer itself is click-through (`pointer-events: none`) so taps still
   * reach the 3D canvas — set `pointer-events: auto` on your controls.
   */
  overlay: HTMLElement;
  /** Current canvas size in CSS pixels. */
  width: number;
  height: number;
}

/** A live game. The shell drives it frame by frame and disposes it on exit. */
export interface GameInstance {
  /** Per frame. dt = seconds since last frame, elapsed = seconds since start. */
  update?(dt: number, elapsed: number): void;
  /** When the window/canvas resizes. */
  resize?(width: number, height: number): void;
  /** Release everything you added: meshes, geometries, materials, listeners. */
  dispose(): void;
}

/** Builds a game from the shell context. One per game directory. */
export type GameFactory = (ctx: GameContext) => GameInstance;

/** One registry entry — see src/games/index.ts. */
export interface GameDefinition {
  /** Unique id; also the directory name under src/games/. */
  id: string;
  title: string;
  /** Grade tag shown on the card, e.g. "2nd grade". */
  grade: string;
  /** Card background color (any CSS color). */
  color: string;
  /** Card emoji. */
  emoji: string;
  /** Factory that builds the game. Omit for a "coming soon" placeholder card. */
  create?: GameFactory;
}
