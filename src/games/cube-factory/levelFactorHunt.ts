import * as THREE from 'three';
import { CELL, ROW_COLORS } from './theme';
import { CubeBlock, disposeTree, makeGridOutline, makePanel } from './cubes';
import { factorPairs } from './math';
import { starsFor, type Level, type LevelKit } from './level';
import { Tweens } from './anim';
import type { StepperHandle } from './ui';

/**
 * Level 3 — the factor hunt.
 *
 * "Build every rectangle with 24 cubes." The kid dials in rows and columns and
 * builds; every rectangle that comes out to exactly 24 is a factor pair and
 * earns a trophy. Turning one sideways is the same rectangle, and the game says
 * so — which is the point where factor pairs stop being a list to memorise.
 */
const TARGETS = [12, 18, 24];

export function createFactorHuntLevel(kit: LevelKit): Level {
  const { scene, hud, sounds, view } = kit;

  const root = new THREE.Group();
  scene.add(root);
  const tweens = new Tweens();

  let targetIndex = 0;
  let target = TARGETS[0];
  let wanted: Array<[number, number]> = [];
  let found = new Set<string>();
  let mistakes = 0;
  let attempts = 0;
  let busy = false;

  let rows = 1;
  let cols = 1;
  let preview: THREE.Group | null = null;
  let cubes: CubeBlock | null = null;
  let steppers: StepperHandle | null = null;

  const pairKey = (r: number, c: number) => `${Math.min(r, c)}x${Math.max(r, c)}`;

  function trophyLabels(): string[] {
    return [...found]
      .map((key) => key.split('x').map(Number))
      .sort((left, right) => left[0] - right[0])
      .map(([small, big]) => `${small} × ${big}`);
  }

  function showPreview() {
    if (preview) disposeTree(preview);
    cubes = null;

    const group = new THREE.Group();
    group.position.set((-cols * CELL) / 2, (-rows * CELL) / 2, 0);
    root.add(group);
    group.add(makeGridOutline(rows, cols, 0xffffff));
    const panel = makePanel(cols * CELL, rows * CELL, 0x4d96ff, 0.22);
    panel.position.z = -0.6;
    group.add(panel);
    preview = group;

    view.frame(cols * CELL, rows * CELL);
    // The product stays hidden: guessing it first is the exercise.
    hud.setTally(`${rows} × ${cols} = ?`);
  }

  function startTarget() {
    target = TARGETS[targetIndex];
    wanted = factorPairs(target);
    found = new Set();
    rows = 1;
    cols = 1;
    busy = false;

    hud.setQuestion(
      `Find every rectangle with ${target} cubes`,
      `${wanted.length} to find — sideways twins count once`,
    );
    hud.setTrophies([]);

    steppers = hud.showSteppers(
      { rows, cols },
      {
        max: target,
        onChange: (nextRows, nextCols) => {
          if (busy) return;
          rows = nextRows;
          cols = nextCols;
          showPreview();
        },
        onBuild: () => build(),
      },
    );
    showPreview();
  }

  function build() {
    if (busy || !preview) return;
    busy = true;
    // Lock the dials while the cubes drop, so presses can't be silently
    // swallowed and then snapped back when the build finishes.
    steppers?.setEnabled(false);
    attempts += 1;

    const block = new CubeBlock(rows, cols, ROW_COLORS[attempts % ROW_COLORS.length], {
      stagger: 0.03,
    });
    cubes = block;
    preview.add(block.object);
    sounds.snap();

    const area = rows * cols;
    tweens.add(0.9, () => undefined, () => judge(area));
  }

  function judge(area: number) {
    hud.setTally(`${rows} × ${cols} = ${area}`);

    if (area !== target) {
      mistakes += 1;
      sounds.wrong();
      hud.toast(`That's ${area}`, 'bad');
      hud.setQuestion(
        `Find every rectangle with ${target} cubes`,
        area < target ? `${area} is too few — make it bigger` : `${area} is too many — make it smaller`,
      );
      resume();
      return;
    }

    const key = pairKey(rows, cols);
    if (found.has(key)) {
      sounds.tick();
      hud.toast('Already found!', 'info');
      hud.setQuestion(
        `Find every rectangle with ${target} cubes`,
        'Turning a rectangle sideways makes the same pair — try a different shape',
      );
      resume();
      return;
    }

    found.add(key);
    sounds.correct();
    hud.toast('A new pair! 🏆', 'good');
    hud.setTrophies(trophyLabels());

    if (found.size === wanted.length) {
      finishTarget();
      return;
    }
    hud.setQuestion(
      `Find every rectangle with ${target} cubes`,
      `${wanted.length - found.size} still hiding`,
    );
    resume();
  }

  function finishTarget() {
    sounds.fanfare();
    hud.hideControls();
    steppers = null;
    hud.setQuestion(`You found them all!`, `Every way to build ${target}`);
    tweens.add(1.6, () => undefined, () => {
      targetIndex += 1;
      if (targetIndex >= TARGETS.length) {
        kit.onDone(starsFor(mistakes));
        return;
      }
      startTarget();
    });
  }

  /** Let the built rectangle be seen for a beat, then clear it for the next try. */
  function resume() {
    tweens.add(1.2, () => undefined, () => {
      busy = false;
      steppers?.setEnabled(true);
      steppers?.set(rows, cols);
      showPreview();
    });
  }

  startTarget();

  return {
    update(dt) {
      tweens.update(dt);
      cubes?.update(dt);
    },
    dispose() {
      tweens.clear();
      if (preview) disposeTree(preview);
      preview = null;
      disposeTree(root);
      hud.hideControls();
    },
  };
}
