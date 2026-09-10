import * as THREE from 'three';
import { Stage } from './Stage';
import { GameLoop } from './GameLoop';
import { Input } from './Input';
import type { GameContext, GameDefinition, GameInstance } from './types';

/**
 * The switchboard between the menu (DOM) and a running game (3D).
 *
 * - showMenu()  : stop any game, hide the 3D stage, ask the app to draw the menu.
 * - startGame() : build the game from a registry entry and run the render loop.
 *
 * It also wires the "back to menu" button. Each game gets a fresh scene and is
 * disposed on exit, so games never leak into one another.
 */
export class GameHost {
  private stage: Stage;
  private loop = new GameLoop();
  private input: Input;
  /** DOM layer for a game's HTML UI. Created here, emptied on exit. */
  private overlay: HTMLElement;

  private current: GameInstance | null = null;
  private scene: THREE.Scene | null = null;
  private removeResize: (() => void) | null = null;

  constructor(
    private stageContainer: HTMLElement,
    private backButton: HTMLButtonElement,
    /** Draws the home menu; called every time we return to it. */
    private showMenuUi: () => void,
  ) {
    this.stage = new Stage(stageContainer);
    this.input = new Input(this.stage.canvas, this.stage.camera);

    // A per-game HTML layer above the canvas. Lives inside #stage, so it hides
    // and shows with it; z-index keeps it below the back button.
    this.overlay = document.createElement('div');
    this.overlay.id = 'game-overlay';
    stageContainer.appendChild(this.overlay);

    this.backButton.addEventListener('click', () => this.showMenu());
  }

  showMenu() {
    this.stopGame();
    this.stageContainer.hidden = true;
    this.backButton.hidden = true;
    this.showMenuUi();
  }

  startGame(def: GameDefinition) {
    if (!def.create) return; // coming-soon placeholder: nothing to run
    this.stopGame();

    const scene = new THREE.Scene();
    this.scene = scene;
    this.stage.resetCamera();

    const ctx: GameContext = {
      scene,
      camera: this.stage.camera,
      renderer: this.stage.renderer,
      input: this.input,
      overlay: this.overlay,
      width: this.stage.width,
      height: this.stage.height,
    };
    this.current = def.create(ctx);

    this.removeResize = this.stage.onResize((w, h) => this.current?.resize?.(w, h));

    this.loop.setFrame((dt, elapsed) => {
      this.current?.update?.(dt, elapsed);
      this.stage.render(scene);
    });

    this.stageContainer.hidden = false;
    this.backButton.hidden = false;
    this.loop.start();
  }

  private stopGame() {
    this.loop.stop();
    this.removeResize?.();
    this.removeResize = null;
    this.current?.dispose();
    this.current = null;
    this.overlay.replaceChildren(); // auto-empty the game's HTML UI
    if (this.scene) {
      disposeScene(this.scene);
      this.scene = null;
    }
  }
}

/** Free GPU resources for everything a game left in its scene. */
function disposeScene(scene: THREE.Scene) {
  scene.traverse((obj) => {
    const mesh = obj as Partial<THREE.Mesh>;
    mesh.geometry?.dispose?.();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose?.();
  });
  scene.clear();
}
