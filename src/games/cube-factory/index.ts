import * as THREE from 'three';
import type { GameContext, GameInstance } from '../../shell/types';
import { SCENE_BG } from './theme';
import { addLights } from './cubes';
import { Hud, starsText } from './ui';
import { Sounds } from './audio';
import { OrbitView } from './view';
import { loadStars, saveStars, type LevelId, type StarBook } from './progress';
import type { Level, LevelKit } from './level';
import { createArraysLevel } from './levelArrays';
import { createAreaModelLevel } from './levelAreaModel';
import { createFactorHuntLevel } from './levelFactorHunt';

/**
 * Cube Factory — multiplication you can build, for around 4th grade.
 *
 * Three machines, in the order the idea grows:
 *   1. Arrays      — 6 x 4 is six rows of four, stamped and skip-counted.
 *   2. Area model  — 13 x 24 splits into four easy blocks that add back up.
 *   3. Factor hunt — every rectangle you can build from one number.
 *
 * Stars per machine live in localStorage. The camera sways the whole time so
 * the cubes read as solid things rather than a picture of a grid.
 */

interface LevelSpec {
  id: LevelId;
  name: string;
  what: string;
  emoji: string;
  color: string;
  create: (kit: LevelKit) => Level;
}

const LEVELS: LevelSpec[] = [
  {
    id: 'arrays',
    name: 'Stamp the Array',
    what: 'Rows of cubes, up to 9 × 9',
    emoji: '🧱',
    color: '#4d96ff',
    create: createArraysLevel,
  },
  {
    id: 'area',
    name: 'Split the Rectangle',
    what: 'Big numbers, four easy pieces',
    emoji: '🧊',
    color: '#6bcb77',
    create: createAreaModelLevel,
  },
  {
    id: 'factors',
    name: 'Factor Hunt',
    what: 'Every rectangle for one number',
    emoji: '🏆',
    color: '#f7a325',
    create: createFactorHuntLevel,
  },
];

export function createCubeFactory(ctx: GameContext): GameInstance {
  const { scene, camera, input, overlay } = ctx;

  scene.background = new THREE.Color(SCENE_BG);
  addLights(scene);

  const sounds = new Sounds();
  const hud = new Hud(overlay, sounds);
  const view = new OrbitView(camera);
  view.frame(12, 12);

  let level: Level | null = null;
  let stars: StarBook = loadStars();
  // The HUD's height changes as controls appear; re-measuring every so often
  // keeps the cubes out from under the number pad without thrashing layout.
  let sinceMeasure = 99;
  // A level finishes from inside its own update(); tearing it down there would
  // pull the floor out mid-frame, so it waits for the next one.
  let teardownPending = false;

  function stopLevel() {
    level?.dispose();
    level = null;
    teardownPending = false;
  }

  function showPicker() {
    stopLevel();
    hud.setQuestion('Cube Factory', 'Multiplication you can build');
    hud.setTally('');
    hud.setTrophies([]);
    hud.hideControls();
    view.frame(12, 12);

    const body = hud.showPanel({
      title: 'Pick a machine',
      bodyHtml: `<div class="cf-levels">${LEVELS.map(cardHtml).join('')}</div>`,
      buttons: [],
    });

    body?.querySelectorAll<HTMLElement>('[data-level]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.level as LevelId | undefined;
        const spec = LEVELS.find((candidate) => candidate.id === id);
        if (spec) startLevel(spec);
      });
    });
  }

  function cardHtml(spec: LevelSpec): string {
    return (
      `<button type="button" class="cf-level" data-level="${spec.id}" style="background:${spec.color}">` +
      `<div class="cf-level__emoji">${spec.emoji}</div>` +
      `<div class="cf-level__name">${spec.name}</div>` +
      `<div class="cf-level__what">${spec.what}</div>` +
      `<div class="cf-level__stars">${starsText(stars[spec.id])}</div>` +
      `</button>`
    );
  }

  function startLevel(spec: LevelSpec) {
    stopLevel();
    hud.hidePanel();
    hud.setTrophies([]);
    hud.setTally('');
    level = spec.create({
      scene,
      input,
      hud,
      sounds,
      view,
      onDone: (earned) => finishLevel(spec, earned),
    });
  }

  function finishLevel(spec: LevelSpec, earned: number) {
    teardownPending = true;
    stars = saveStars(spec.id, earned);
    sounds.fanfare();
    hud.hideControls();
    hud.setQuestion('', '');
    hud.setTally('');
    hud.setTrophies([]);
    hud.showPanel({
      title: `${spec.name} — done!`,
      bodyHtml: `<div class="cf-bigstars">${starsText(earned)}</div><div>${praise(earned)}</div>`,
      buttons: [
        { label: 'Play it again', onClick: () => startLevel(spec), primary: true },
        { label: 'Pick another', onClick: showPicker },
      ],
    });
  }

  showPicker();

  return {
    update(dt) {
      if (teardownPending) stopLevel();
      if (++sinceMeasure >= 10) {
        sinceMeasure = 0;
        const { top, bottom } = hud.bands();
        view.setBands(top, bottom);
      }
      level?.update(dt);
      view.update(dt);
    },
    resize() {
      sinceMeasure = 99;
      view.resize();
      level?.resize?.();
    },
    dispose() {
      stopLevel();
      hud.dispose();
      sounds.dispose();
    },
  };
}

function praise(stars: number): string {
  if (stars >= 3) return 'Perfect run — not one slip!';
  if (stars === 2) return 'Nicely done!';
  return 'You finished it! Try again for more stars.';
}
