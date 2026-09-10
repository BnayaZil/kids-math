import * as THREE from 'three';
import type { GameContext, GameInstance } from '../../shell/types';
import { MAX, MIN, levels, starsForHops, type Level, type Problem } from './levels';
import { loadStars, saveStars, type StarMap } from './progress';
import { createNumberLine } from './numberLine';
import { createFrog } from './frog';
import { createConfetti } from './confetti';
import { createUi } from './ui';
import {
  disposeSound,
  playBlocked,
  playHopBig,
  playHopSmall,
  playLevelComplete,
  playOvershoot,
  playWin,
} from './sound';

/**
 * NUMBER HOPPER — addition and subtraction within 100 on a 3D number line.
 *
 * The child is not asked for an answer. They are put down on the first number
 * and told to travel the second one: "37 + 25" means "you are on 37, now go
 * 25 further". They do it with four buttons — +10, +1, −10, −1 — and because
 * the road is one world unit per number, a tens hop really is ten times the
 * length of a ones hop. Decomposing 25 into two tens and five ones is the
 * lesson, and the road is what makes it visible.
 *
 * Landing exactly on the answer wins. Going too far is never a failure: the
 * frog gets a nudge to hop back and the child keeps going, with no limit on
 * tries and no way to lose.
 */

/**
 * How many numbers of road to keep in view. Sets the camera distance.
 * Two tens either side of the frog: enough for a +10 hop to read as a long
 * leap, close enough that the character is not a speck.
 */
const VISIBLE_NUMBERS = 22;

/** Seconds of celebration before the next challenge appears. */
const CELEBRATION = 1.7;

type Phase = 'levels' | 'playing' | 'celebrating' | 'levelDone';

/** Where the frog has to go, and which way is "forwards" for this problem. */
function direction(problem: Problem): 1 | -1 {
  return problem.op === 'add' ? 1 : -1;
}

export function createNumberHopper(ctx: GameContext): GameInstance {
  const { scene, camera, overlay } = ctx;

  // ---- world -------------------------------------------------------------
  const sky = new THREE.Color(0xbfe6ff);
  scene.background = sky;
  // Fog fades both the far ends of a 100-unit road and the far edge of the
  // ground into the sky, so neither ends in a hard line.
  scene.fog = new THREE.Fog(sky, 42, 105);

  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(-8, 14, 10);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b8f4f, 1.1));

  const road = createNumberLine();
  scene.add(road.group);

  const frog = createFrog();
  scene.add(frog.group);

  const confetti = createConfetti();
  scene.add(confetti.points);

  // ---- camera ------------------------------------------------------------
  // The shell resets the camera before each game, so this game owns it fully.
  let cameraX = 0;
  let cameraDistance = 13;
  let cameraHeight = 6;

  function frameCamera(width: number, height: number) {
    const aspect = height === 0 ? 1.6 : width / height;
    const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // A narrow screen has a narrow horizontal view, so insisting on the full
    // span of numbers would shove the camera far enough back to turn the frog
    // into a speck. A phone gets fewer numbers and a closer, bigger frog.
    const wanted = THREE.MathUtils.clamp(
      VISIBLE_NUMBERS * Math.min(1, aspect / 1.4),
      9,
      VISIBLE_NUMBERS,
    );
    const ideal = wanted / 2 / (halfV * aspect);
    cameraDistance = THREE.MathUtils.clamp(ideal, 11, 26);
    cameraHeight = cameraDistance * 0.46;
  }

  frameCamera(ctx.width, ctx.height);

  // ---- game state --------------------------------------------------------
  let phase: Phase = 'levels';
  let level: Level | null = null;
  let problem: Problem | null = null;
  let problemIndex = 0;
  let hops = 0;
  let earned: number[] = [];
  let stars: StarMap = loadStars();
  /** Counts down the celebration, then advances. Driven by update(), not a
   *  timer, so it cannot fire after the game has been disposed. */
  let waitLeft = 0;

  const ui = createUi(overlay, {
    onHop: hop,
    onPickLevel: startLevel,
    onReplayLevel: () => {
      if (level) startLevel(level.id);
    },
    onBackToLevels: showLevels,
  });

  function showLevels() {
    phase = 'levels';
    level = null;
    problem = null;
    ui.showLevelPicker(stars);
  }

  function startLevel(id: number) {
    const found = levels.find((l) => l.id === id);
    if (!found) return;
    level = found;
    problemIndex = 0;
    earned = [];
    nextProblem();
  }

  function nextProblem() {
    if (!level) return;
    const next = level.makeProblem();
    problem = next;
    hops = 0;
    phase = 'playing';

    frog.placeAt(next.start);
    cameraX = next.start;

    const sign = next.op === 'add' ? '+' : '−';
    ui.setSum(`${next.start} ${sign} ${next.amount} = ?`);
    ui.setProgress(0, next.amount);
    ui.showPlaying();
    ui.setHopsEnabled(true);
  }

  function hop(delta: number) {
    if (phase !== 'playing' || !problem || frog.isHopping) return;

    const destination = frog.value + delta;
    if (destination < MIN || destination > MAX) {
      // The road is the whole number range, so there is nothing off its end.
      frog.shake();
      playBlocked();
      ui.flashHint(destination < MIN ? '0 is the start! 🛑' : '100 is the end! 🛑');
      return;
    }

    hops += 1;
    ui.setHopsEnabled(false);
    if (Math.abs(delta) === 10) playHopBig();
    else playHopSmall();

    frog.hopTo(destination, land);
  }

  function land() {
    if (!problem) return;
    const forward = direction(problem);
    // Measured towards the answer, so a wrong-way hop counts as negative.
    const travelled = (frog.value - problem.start) * forward;
    ui.setProgress(travelled, problem.amount);

    if (frog.value === problem.target) {
      win();
      return;
    }

    const past = (frog.value - problem.target) * forward > 0;
    const wrongWay = travelled < 0;

    if (past) {
      playOvershoot();
      ui.flashHint(forward > 0 ? 'Hop back! ⬅️' : 'Hop back! ➡️');
    } else if (wrongWay) {
      playOvershoot();
      ui.flashHint(forward > 0 ? 'Other way! ➡️' : 'Other way! ⬅️');
    }

    ui.setHopsEnabled(true);
  }

  function win() {
    if (!problem) return;
    phase = 'celebrating';
    earned.push(starsForHops(hops, problem.amount));

    confetti.burst(frog.value, 1.4, 0.6);
    playWin();
    ui.flashHint('Yes! 🎉', 'good');
    ui.setHopsEnabled(false);
    waitLeft = CELEBRATION;
  }

  function finishLevel() {
    if (!level) return;
    // The average across the level, rounded down but never below one star:
    // one clumsy challenge should not wipe out four good ones, and finishing
    // at all is always worth something.
    const total = earned.reduce((sum, n) => sum + n, 0);
    const average = earned.length === 0 ? 1 : Math.floor(total / earned.length);
    const result = Math.min(3, Math.max(1, average));

    stars = saveStars(level.id, result);
    phase = 'levelDone';
    playLevelComplete();
    ui.showLevelComplete(level, result, stars[level.id] ?? result);
  }

  ui.showLevelPicker(stars);

  return {
    update(dt, elapsed) {
      frog.update(dt, elapsed);
      confetti.update(dt);

      if (waitLeft > 0) {
        waitLeft -= dt;
        if (waitLeft <= 0) {
          waitLeft = 0;
          problemIndex += 1;
          if (level && problemIndex >= level.problemCount) finishLevel();
          else nextProblem();
        }
      }

      // Follow the frog, easing rather than snapping, and look slightly ahead
      // so a long hop does not leave the screen before the camera reacts.
      const lead = frog.isHopping ? (frog.group.position.x - cameraX) * 0.35 : 0;
      const wanted = THREE.MathUtils.clamp(frog.group.position.x + lead, MIN, MAX);
      cameraX += (wanted - cameraX) * Math.min(dt * 4.5, 1);

      camera.position.set(cameraX, cameraHeight, cameraDistance);
      camera.lookAt(cameraX, 1.4, 0);
    },

    resize(width, height) {
      frameCamera(width, height);
    },

    dispose() {
      ui.dispose();
      disposeSound();
      frog.dispose();
      road.dispose();
      confetti.dispose();
      scene.fog = null;
    },
  };
}
