import * as THREE from 'three';
import { CELL, ROW_COLORS } from './theme';
import { CubeBlock, disposeTree, makeGridOutline, makePanel } from './cubes';
import { randomInt, skipCounts } from './math';
import { starsFor, type Level, type LevelKit } from './level';
import { Tweens } from './anim';

/**
 * Level 1 — Arrays.
 *
 * "6 x 4" is six rows of four. The kid stamps one row at a time and watches the
 * skip count climb (4, 8, 12...), so multiplication arrives as repeated
 * addition you can see and touch, before any answer is asked for.
 *
 * Sizes ramp from 3x3 up to 9x9 across five problems.
 */
const PROBLEM_COUNT = 5;

export function createArraysLevel(kit: LevelKit): Level {
  const { scene, input, hud, sounds, view } = kit;

  const root = new THREE.Group();
  scene.add(root);
  const tweens = new Tweens();

  let problemIndex = 0;
  let mistakes = 0;
  let pulse = 0;

  let rows = 0;
  let cols = 0;
  let stamped = 0;
  let wrongHere = 0;
  let phase: 'stamping' | 'answering' | 'waiting' = 'stamping';

  let group: THREE.Group | null = null;
  let blocks: CubeBlock[] = [];
  let highlight: THREE.Mesh | null = null;
  let tapTarget: THREE.Mesh | null = null;

  function clearBoard() {
    if (group) disposeTree(group);
    group = null;
    blocks = [];
    highlight = null;
    tapTarget = null;
  }

  function startProblem() {
    clearBoard();

    // 3, 5, 6, 8, 9 — the last problems reach the full 9x9 table.
    const cap = Math.min(9, Math.round(3 + problemIndex * 1.5));
    rows = randomInt(2, cap);
    cols = randomInt(2, cap);
    stamped = 0;
    wrongHere = 0;
    phase = 'stamping';

    const board = new THREE.Group();
    board.position.set((-cols * CELL) / 2, (-rows * CELL) / 2, 0);
    root.add(board);
    group = board;

    board.add(makeGridOutline(rows, cols, 0xffffff));

    // One invisible plate over the whole grid: a nine-year-old should not have
    // to aim at a single row to stamp it.
    tapTarget = makePanel(cols * CELL, rows * CELL, 0xffffff, 0);
    tapTarget.position.z = 0.4;
    board.add(tapTarget);

    highlight = makePanel(cols * CELL, CELL, 0xffd93d, 0.3);
    board.add(highlight);
    placeHighlight();

    view.frame(cols * CELL, rows * CELL);
    hud.setQuestion(
      `${rows} × ${cols}`,
      `Tap the glowing row to stamp ${cols} cube${cols === 1 ? '' : 's'}`,
    );
    hud.setTally('');
    hud.hideControls();
  }

  function placeHighlight() {
    if (!highlight) return;
    highlight.visible = stamped < rows;
    highlight.position.set(0, stamped * CELL, 0.2);
  }

  function stampRow() {
    if (!group || stamped >= rows) return;

    const block = new CubeBlock(1, cols, ROW_COLORS[stamped % ROW_COLORS.length]);
    block.object.position.set(0, stamped * CELL, 0);
    group.add(block.object);
    blocks.push(block);
    stamped += 1;
    sounds.snap();

    hud.setTally(skipCounts(cols, stamped).join(',  '));
    placeHighlight();

    if (stamped === rows) {
      phase = 'answering';
      askForTotal();
    }
  }

  function askForTotal() {
    hud.setQuestion(`${rows} × ${cols}`, 'How many cubes altogether?');
    hud.showPad((value) => {
      if (value === rows * cols) {
        sounds.correct();
        hud.toast('Yes! 🎉', 'good');
        hud.hideControls();
        phase = 'waiting';
        tweens.add(1, () => undefined, nextProblem);
        return;
      }

      mistakes += 1;
      wrongHere += 1;
      sounds.wrong();
      hud.shake();
      hud.clearEntry();
      hud.toast('Not yet', 'bad');

      // First miss nudges the strategy; a second one counts it out in full.
      const counts = skipCounts(cols, rows);
      const hint =
        wrongHere === 1
          ? `Count the rows by ${cols}: ${counts.slice(0, 3).join(', ')} ...`
          : `Count with me: ${counts.join(', ')}`;
      hud.setQuestion(`${rows} × ${cols}`, hint);
    });
  }

  function nextProblem() {
    problemIndex += 1;
    if (problemIndex >= PROBLEM_COUNT) {
      kit.onDone(starsFor(mistakes));
      return;
    }
    startProblem();
  }

  const untap = input.onTap((event) => {
    if (phase !== 'stamping' || !tapTarget) return;
    if (!input.pick(event, [tapTarget])) return;
    stampRow();
  });

  startProblem();

  return {
    update(dt) {
      tweens.update(dt);
      for (const block of blocks) block.update(dt);

      if (highlight && phase === 'stamping') {
        pulse += dt;
        const material = highlight.material as THREE.MeshBasicMaterial;
        material.opacity = 0.24 + Math.sin(pulse * 5) * 0.13;
      }
    },
    dispose() {
      untap();
      tweens.clear();
      clearBoard();
      disposeTree(root);
      hud.hideControls();
    },
  };
}
