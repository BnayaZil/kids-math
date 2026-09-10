import './number-hopper.css';
import { levels, type Level } from './levels';
import type { StarMap } from './progress';

/**
 * Everything the child touches or reads, as DOM on top of the 3D scene.
 *
 * The buttons are DOM rather than 3D objects on purpose: a browser gives big
 * reliable touch targets, focus rings and keyboard access for free, and none
 * of that is worth re-implementing with raycasts.
 *
 * This module takes its mount point as a plain HTMLElement and knows nothing
 * about the shell, so it can be handed the shell's overlay element without
 * depending on the shell's types.
 */

/** Reading is kept to a minimum — numerals, emoji, and at most two words. */
const HOP_BUTTONS: ReadonlyArray<{ delta: number; label: string; kind: 'ten' | 'one' }> = [
  { delta: -10, label: '−10', kind: 'ten' },
  { delta: -1, label: '−1', kind: 'one' },
  { delta: 1, label: '+1', kind: 'one' },
  { delta: 10, label: '+10', kind: 'ten' },
];

const LEVEL_COLORS = ['#6bcb77', '#4d96ff', '#a66bff', '#ff9f43', '#ff6b6b'];

export interface UiHandlers {
  /** A hop button was pressed. */
  onHop(delta: number): void;
  onPickLevel(levelId: number): void;
  /** "Again" on the level-complete panel. */
  onReplayLevel(): void;
  /** "Levels" on the level-complete panel. */
  onBackToLevels(): void;
}

export interface HopperUi {
  showLevelPicker(stars: StarMap): void;
  showPlaying(): void;
  showLevelComplete(level: Level, stars: number, best: number): void;
  /** The challenge, e.g. "37 + 25 = ?". */
  setSum(text: string): void;
  /** How much of the journey is done, as a bar plus "20 / 25". */
  setProgress(travelled: number, total: number): void;
  /** Locked while the frog is mid-hop or celebrating. */
  setHopsEnabled(enabled: boolean): void;
  flashHint(text: string, tone?: 'good' | 'nudge'): void;
  dispose(): void;
}

function stars(count: number): string {
  return '★★★☆☆☆'.slice(3 - count, 6 - count);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createUi(host: HTMLElement, handlers: UiHandlers): HopperUi {
  const root = el('div', 'nh-root');

  // ---- the sum and the journey bar ---------------------------------------
  const banner = el('div', 'nh-banner');
  const sum = el('div', 'nh-sum', '');
  const progress = el('div', 'nh-progress');
  const track = el('div', 'nh-progress__track');
  const fill = el('div', 'nh-progress__fill');
  const count = el('div', 'nh-progress__count', '');
  track.append(fill);
  progress.append(track, count);
  banner.append(sum, progress);

  // ---- coaching line, centre screen --------------------------------------
  const hint = el('div', 'nh-hint');

  // ---- the four hop buttons ----------------------------------------------
  const pad = el('div', 'nh-pad');
  const hopButtons: HTMLButtonElement[] = HOP_BUTTONS.map(({ delta, label, kind }) => {
    const button = el('button', `nh-hop nh-hop--${kind}`, label);
    button.type = 'button';
    // Spoken label, since the visible text is a bare numeral.
    button.setAttribute('aria-label', `${delta > 0 ? 'add' : 'take away'} ${Math.abs(delta)}`);
    button.addEventListener('click', () => handlers.onHop(delta));
    return button;
  });
  pad.append(...hopButtons);

  root.append(banner, hint, pad);
  host.append(root);

  /** Panels (level picker, level complete) are built on demand and replaced. */
  let panel: HTMLElement | null = null;
  let hintTimer: number | undefined;

  function clearPanel() {
    panel?.remove();
    panel = null;
  }

  function setPlayVisible(visible: boolean) {
    banner.hidden = !visible;
    pad.hidden = !visible;
    if (!visible) hint.classList.remove('nh-hint--show');
  }

  // Keyboard as well as touch: arrows for ones, shift+arrows for tens. Mouse
  // and finger are the main paths, but a keyboard costs four lines here.
  const onKey = (ev: KeyboardEvent) => {
    if (pad.hidden) return;
    const step = ev.shiftKey ? 10 : 1;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') handlers.onHop(step);
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') handlers.onHop(-step);
    else return;
    ev.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  return {
    showLevelPicker(saved) {
      clearPanel();
      setPlayVisible(false);

      const picker = el('div', 'nh-panel');
      picker.append(el('h2', 'nh-panel__title', 'Pick a level 🐸'));

      const grid = el('div', 'nh-levels');
      levels.forEach((level, i) => {
        const card = el('button', 'nh-level');
        card.type = 'button';
        card.style.setProperty('--nh-level-color', LEVEL_COLORS[i % LEVEL_COLORS.length]);
        card.append(
          el('span', 'nh-level__emoji', level.emoji),
          el('span', 'nh-level__title', level.title),
          el('span', 'nh-stars', stars(saved[level.id] ?? 0)),
        );
        card.addEventListener('click', () => handlers.onPickLevel(level.id));
        grid.append(card);
      });

      picker.append(grid);
      panel = picker;
      root.append(picker);
    },

    showPlaying() {
      clearPanel();
      setPlayVisible(true);
    },

    showLevelComplete(level, earned, best) {
      clearPanel();
      setPlayVisible(false);

      const done = el('div', 'nh-panel');
      done.append(
        el('h2', 'nh-panel__title', `${level.emoji} ${level.title}`),
        el('div', 'nh-result-stars', stars(earned)),
      );
      // Only mention the record when it is actually better than this run,
      // so a good run is never undercut by a number.
      if (best > earned) {
        done.append(el('div', 'nh-panel__title', `Best: ${stars(best)}`));
      }

      const buttons = el('div', 'nh-panel__buttons');
      const again = el('button', 'nh-action', 'Again 🔁');
      again.type = 'button';
      again.addEventListener('click', () => handlers.onReplayLevel());

      const pickAnother = el('button', 'nh-action nh-action--secondary', 'Levels 🗺️');
      pickAnother.type = 'button';
      pickAnother.addEventListener('click', () => handlers.onBackToLevels());

      buttons.append(again, pickAnother);
      done.append(buttons);
      panel = done;
      root.append(done);
    },

    setSum(text) {
      sum.textContent = text;
    },

    setProgress(travelled, total) {
      // `travelled` is signed towards the answer, so hopping the wrong way
      // reads as zero rather than as progress. Overshooting is allowed to run
      // past the total — "30 / 25" is exactly the fact the child needs.
      const ratio = total === 0 ? 0 : Math.min(Math.max(travelled, 0) / total, 1);
      fill.style.width = `${ratio * 100}%`;
      count.textContent = `${Math.max(0, travelled)} / ${total}`;
    },

    setHopsEnabled(enabled) {
      hopButtons.forEach((b) => {
        b.disabled = !enabled;
      });
    },

    flashHint(text, tone = 'nudge') {
      hint.textContent = text;
      hint.classList.toggle('nh-hint--good', tone === 'good');
      hint.classList.add('nh-hint--show');
      window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => hint.classList.remove('nh-hint--show'), 1400);
    },

    dispose() {
      window.clearTimeout(hintTimer);
      window.removeEventListener('keydown', onKey);
      clearPanel();
      root.remove();
    },
  };
}
