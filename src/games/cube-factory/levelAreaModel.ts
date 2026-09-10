import * as THREE from 'three';
import { BLOCK_COLORS, CELL } from './theme';
import { CubeBlock, disposeTree, makeGridOutline, makeLabel, makePanel } from './cubes';
import { partialProducts, randomInt, splitPlaceValue, type PartialProduct } from './math';
import { starsFor, type Level, type LevelKit } from './level';
import { easeInOutCubic, Tweens } from './anim';

/**
 * Level 2 — the area model. The heart of the game.
 *
 * A big rectangle for "13 x 24" splits along its place values into four
 * blocks — 10x20, 10x4, 3x20 and 3x4. The kid works out each block on its own,
 * watches it fill with cubes, and then adds the four easy answers into the hard
 * one. That is the whole idea: a big multiplication is a few small ones.
 *
 * The ramp runs from 2-digit x 1-digit (two blocks) to 2-digit x 2-digit (four).
 */
const PROBLEM_COUNT = 5;

/** How far the pieces drift apart when the rectangle splits, in cells. */
const SPLIT_GAP = 1.7;

interface Block {
  part: PartialProduct;
  group: THREE.Group;
  panel: THREE.Mesh;
  label: THREE.Sprite;
  cubes: CubeBlock | null;
  answered: boolean;
}

export function createAreaModelLevel(kit: LevelKit): Level {
  const { scene, hud, sounds, view } = kit;

  const root = new THREE.Group();
  scene.add(root);
  const tweens = new Tweens();

  let problemIndex = 0;
  let mistakes = 0;
  let pulse = 0;

  let a = 0;
  let b = 0;
  let rowParts: number[] = [];
  let colParts: number[] = [];
  let blocks: Block[] = [];
  let current = -1;
  let wrongHere = 0;
  let gap = 0;

  let board: THREE.Group | null = null;

  /** Two digits times one digit at first, two by two once that lands. */
  function chooseFactors(index: number): { a: number; b: number } {
    if (index === 0) return { a: randomInt(12, 19), b: randomInt(3, 6) };
    if (index === 1) return { a: randomInt(21, 29), b: randomInt(4, 9) };
    if (index === 2) return { a: randomInt(12, 19), b: randomInt(12, 19) };
    if (index === 3) return { a: randomInt(12, 19), b: randomInt(21, 26) };
    return { a: randomInt(21, 26), b: randomInt(21, 26) };
  }

  /** Block positions for a given gap. Biggest place value top-left. */
  function layout(currentGap: number) {
    const colX: number[] = [];
    let x = 0;
    for (const part of colParts) {
      colX.push(x);
      x += part * CELL + currentGap;
    }
    const totalWidth = x - currentGap;

    const rowY: number[] = [];
    let y = 0;
    for (let i = rowParts.length - 1; i >= 0; i--) {
      rowY[i] = y;
      y += rowParts[i] * CELL + currentGap;
    }
    const totalHeight = y - currentGap;

    return { colX, rowY, totalWidth, totalHeight };
  }

  function applyLayout(currentGap: number) {
    gap = currentGap;
    const { colX, rowY, totalWidth, totalHeight } = layout(currentGap);
    for (const block of blocks) {
      block.group.position.set(colX[block.part.col], rowY[block.part.row], 0);
    }
    if (board) board.position.set(-totalWidth / 2, -totalHeight / 2, 0);
    view.frame(totalWidth, totalHeight);
  }

  function labelHeight(part: PartialProduct): number {
    const smaller = Math.min(part.a, part.b) * CELL;
    return Math.min(2, Math.max(0.75, smaller * 0.32));
  }

  function setLabel(block: Block, text: string) {
    const old = block.label;
    old.material.map?.dispose();
    old.material.dispose();
    old.removeFromParent();

    const label = makeLabel(text, { height: labelHeight(block.part) });
    label.position.set(
      (block.part.b * CELL) / 2,
      (block.part.a * CELL) / 2,
      1.2,
    );
    block.group.add(label);
    block.label = label;
  }

  function clearBoard() {
    if (board) disposeTree(board);
    board = null;
    blocks = [];
    current = -1;
  }

  function startProblem() {
    clearBoard();

    const factors = chooseFactors(problemIndex);
    a = factors.a;
    b = factors.b;
    rowParts = splitPlaceValue(a);
    colParts = splitPlaceValue(b);
    wrongHere = 0;

    const holder = new THREE.Group();
    root.add(holder);
    board = holder;

    blocks = partialProducts(a, b).map((part, index) => {
      const group = new THREE.Group();
      holder.add(group);

      const color = BLOCK_COLORS[index % BLOCK_COLORS.length];
      const panel = makePanel(part.b * CELL, part.a * CELL, color, 0.28);
      panel.position.z = -0.6;
      group.add(panel);

      const outline = makeGridOutline(part.a, part.b, color);
      outline.position.z = -0.55;
      group.add(outline);

      const label = makeLabel(`${part.a} × ${part.b}`, { height: labelHeight(part) });
      label.position.set((part.b * CELL) / 2, (part.a * CELL) / 2, 1.2);
      group.add(label);

      return { part, group, panel, label, cubes: null, answered: false };
    });

    hud.setQuestion(`${a} × ${b}`, 'Too big? Watch it split into easy pieces!');
    hud.setTally('');
    hud.hideControls();

    // Start as one solid rectangle, then let it come apart.
    applyLayout(0);
    tweens.add(
      0.9,
      (t) => applyLayout(easeInOutCubic(t) * SPLIT_GAP),
      () => askBlock(0),
    );
  }

  /** "1 x 2 = 2, then add two zeros" — the trick these blocks exist to teach. */
  function hintFor(part: PartialProduct, deep: boolean): string {
    const zerosA = trailingZeros(part.a);
    const zerosB = trailingZeros(part.b);
    const zeros = zerosA + zerosB;
    if (zeros === 0) return `Think of ${part.a} rows of ${part.b}.`;
    const baseA = part.a / 10 ** zerosA;
    const baseB = part.b / 10 ** zerosB;
    const core = `${baseA} × ${baseB} = ${baseA * baseB}, then add ${zeros} zero${zeros === 1 ? '' : 's'}.`;
    return deep ? `${core} That makes ${part.product}.` : core;
  }

  function askBlock(index: number) {
    current = index;
    wrongHere = 0;
    const block = blocks[index];
    hud.setQuestion(
      `${block.part.a} × ${block.part.b}`,
      `Piece ${index + 1} of ${blocks.length} — fill it with cubes`,
    );
    hud.showPad((value) => {
      if (value === block.part.product) {
        acceptBlock(block);
        return;
      }
      mistakes += 1;
      wrongHere += 1;
      sounds.wrong();
      hud.shake();
      hud.clearEntry();
      hud.toast('Not yet', 'bad');
      hud.setQuestion(`${block.part.a} × ${block.part.b}`, hintFor(block.part, wrongHere >= 2));
    });
  }

  function acceptBlock(block: Block) {
    block.answered = true;
    sounds.correct();
    hud.toast('Yes! 🎉', 'good');
    hud.hideControls();

    const color = (block.panel.material as THREE.MeshBasicMaterial).color.getHex();
    const cubes = new CubeBlock(block.part.a, block.part.b, color, { stagger: 0.02 });
    block.cubes = cubes;
    block.group.add(cubes.object);
    (block.panel.material as THREE.MeshBasicMaterial).opacity = 0.12;
    setLabel(block, `${block.part.a} × ${block.part.b} = ${block.part.product}`);

    hud.setTally(answeredSum());

    const next = blocks.findIndex((candidate) => !candidate.answered);
    current = -1;
    tweens.add(0.85, () => undefined, () => {
      if (next === -1) askTotal();
      else askBlock(next);
    });
  }

  function answeredSum(): string {
    const done = blocks.filter((block) => block.answered);
    if (done.length === 0) return '';
    const parts = done.map((block) => block.part.product);
    const sum = parts.reduce((acc, value) => acc + value, 0);
    return done.length === 1 ? `${parts[0]}` : `${parts.join(' + ')} = ${sum}`;
  }

  function askTotal() {
    const parts = blocks.map((block) => block.part.product);
    const total = a * b;
    hud.setQuestion(parts.join(' + '), `Add the pieces to finish ${a} × ${b}`);
    hud.setTally('');
    hud.showPad((value) => {
      if (value === total) {
        sounds.fanfare();
        hud.toast('You did it! 🎉', 'good');
        hud.hideControls();
        hud.setQuestion(`${a} × ${b} = ${total}`, 'Watch the pieces fuse back together');
        // Fuse: the blocks slide back into one solid rectangle.
        const from = gap;
        tweens.add(
          0.8,
          (t) => applyLayout(from * (1 - easeInOutCubic(t))),
          () => tweens.add(0.7, () => undefined, nextProblem),
        );
        return;
      }
      mistakes += 1;
      wrongHere += 1;
      sounds.wrong();
      hud.shake();
      hud.clearEntry();
      hud.toast('Not yet', 'bad');
      const running = parts.slice(0, 2).reduce((acc, value) => acc + value, 0);
      hud.setQuestion(
        parts.join(' + '),
        wrongHere >= 2
          ? `Two at a time: ${parts[0]} + ${parts[1]} = ${running}, then keep going.`
          : 'Add them two at a time.',
      );
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

  startProblem();

  return {
    update(dt) {
      tweens.update(dt);
      pulse += dt;
      for (const block of blocks) {
        block.cubes?.update(dt);
      }
      // The piece being asked about breathes; the rest sit quiet.
      blocks.forEach((block, index) => {
        if (block.answered) return;
        const material = block.panel.material as THREE.MeshBasicMaterial;
        material.opacity =
          index === current ? 0.34 + Math.sin(pulse * 4.5) * 0.14 : 0.2;
      });
    },
    dispose() {
      tweens.clear();
      clearBoard();
      disposeTree(root);
      hud.hideControls();
    },
  };
}

function trailingZeros(value: number): number {
  let zeros = 0;
  let rest = value;
  while (rest > 0 && rest % 10 === 0) {
    zeros += 1;
    rest /= 10;
  }
  return zeros;
}
