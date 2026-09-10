import type { Sounds } from './audio';

/**
 * The flat, readable half of Cube Factory: question, number pad, panels.
 *
 * It mounts into the element the shell hands the game and takes everything
 * away again on dispose(). Its own <style> lives inside that element too, so
 * nothing leaks into the page. Every class is prefixed `cf-`.
 *
 * The top row starts 88px down so it can never sit on the shell's
 * "back to menu" button, which occupies the top-left corner.
 */

export interface PanelButton {
  label: string;
  onClick: () => void;
  /** The one button styled as the obvious thing to press. */
  primary?: boolean;
}

export interface StepperHandle {
  set(rows: number, cols: number): void;
  /** Grey the controls out while the factory is busy building. */
  setEnabled(enabled: boolean): void;
}

export class Hud {
  private readonly root: HTMLDivElement;
  private readonly styleEl: HTMLStyleElement;
  private readonly topEl: HTMLDivElement;
  private readonly questionEl: HTMLDivElement;
  private readonly subEl: HTMLDivElement;
  private readonly tallyEl: HTMLDivElement;
  private readonly trophiesEl: HTMLDivElement;
  private readonly bottomEl: HTMLDivElement;
  private readonly toastEl: HTMLDivElement;
  private readonly panelEl: HTMLDivElement;

  private entryEl: HTMLDivElement | null = null;
  private entry = '';
  private toastTimer = 0;
  private padKeys: HTMLButtonElement[] = [];
  private onLayout: (() => void) | null = null;

  constructor(
    mount: HTMLElement,
    private readonly sounds: Sounds,
  ) {
    this.styleEl = document.createElement('style');
    this.styleEl.textContent = CSS;

    this.root = div('cf-root');

    const top = div('cf-top');
    this.topEl = top;
    this.questionEl = div('cf-question');
    this.subEl = div('cf-sub');
    this.tallyEl = div('cf-tally');
    this.trophiesEl = div('cf-trophies');
    this.toastEl = div('cf-toast');
    // The toast lives INSIDE the top block, in a slot that is always reserved.
    // Floating it over the scene meant it covered whatever was behind it —
    // first the running sum, then a block's label. A permanent slot cannot
    // overlap anything, and because it is always there the HUD's height never
    // changes when it appears, so the cubes do not pump.
    top.append(this.questionEl, this.subEl, this.tallyEl, this.trophiesEl, this.toastEl);

    this.bottomEl = div('cf-bottom');
    this.panelEl = div('cf-panel');
    this.panelEl.hidden = true;

    this.root.append(top, div('cf-spacer'), this.bottomEl, this.panelEl);
    mount.append(this.styleEl, this.root);
  }

  /**
   * Called whenever anything that changes the HUD's height happens, so the
   * camera can re-measure in the SAME frame. Polling for this was the bug: for
   * about a sixth of a second after the pad reappeared, the camera was still
   * framed for a screen with no pad, and the cubes sat under the keys.
   */
  setLayoutListener(fn: () => void) {
    this.onLayout = fn;
  }

  setQuestion(main: string, sub = '') {
    this.questionEl.textContent = main;
    // "13 × 24" wants to be huge; "Find every rectangle with 18 cubes" does not.
    this.questionEl.classList.toggle('cf-question--long', main.length > 16);
    this.subEl.textContent = sub;
    this.notifyLayout();
  }

  /**
   * Measure how much screen height the HUD is really eating, top and bottom, as
   * fractions of the overlay — and park the toast just below the top block
   * while we have the numbers, so a celebration never lands on the question or
   * the running sum.
   */
  measure(): { top: number; bottom: number } {
    const fallback = { top: 0.22, bottom: 0.28 };
    try {
      const whole = this.root.getBoundingClientRect();
      if (!whole || whole.height <= 0) return fallback;
      const topRect = this.topEl.getBoundingClientRect();
      const hasControls = this.bottomEl.children.length > 0;
      const bottomRect = this.bottomEl.getBoundingClientRect();

      const topPx = Math.max(0, topRect.bottom - whole.top);
      return {
        top: topPx / whole.height,
        bottom: hasControls ? Math.max(0, whole.bottom - bottomRect.top) / whole.height : 0.04,
      };
    } catch {
      // Measuring must never be the thing that stops the game.
      return fallback;
    }
  }

  /** The chip under the question: skip counts, progress, the running area. */
  setTally(text: string) {
    this.tallyEl.textContent = text;
    this.tallyEl.hidden = text === '';
    this.notifyLayout();
  }

  /** The factor pairs found so far, as trophy chips under the question. */
  setTrophies(labels: string[]) {
    this.trophiesEl.replaceChildren();
    for (const label of labels) {
      const chip = div('cf-trophy');
      chip.textContent = `🏆 ${label}`;
      this.trophiesEl.append(chip);
    }
    this.notifyLayout();
  }

  /** Big centred word: "Yes!", "Try again". Fades itself out. */
  toast(text: string, tone: 'good' | 'bad' | 'info' = 'info') {
    this.toastEl.textContent = text;
    this.toastEl.className = `cf-toast cf-toast--show cf-toast--${tone}`;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.className = 'cf-toast';
    }, 1100);
  }

  /**
   * Show the number pad. `onSubmit` fires when the kid presses the green tick
   * with at least one digit typed.
   */
  showPad(onSubmit: (value: number) => void) {
    this.clearBottom();
    this.entry = '';

    const entryEl = div('cf-entry');
    this.entryEl = entryEl;
    entryEl.textContent = '?';

    const pad = div('cf-pad');
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'];
    for (const key of keys) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cf-key';
      if (key === 'go') {
        btn.classList.add('cf-key--go');
        btn.textContent = '✓';
        btn.setAttribute('aria-label', 'Check my answer');
      } else if (key === 'del') {
        btn.classList.add('cf-key--del');
        btn.textContent = '⌫';
        btn.setAttribute('aria-label', 'Delete');
      } else {
        btn.textContent = key;
      }
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        if (key === 'go') {
          if (this.entry === '') {
            this.shake();
            return;
          }
          onSubmit(Number(this.entry));
          return;
        }
        if (key === 'del') {
          this.entry = this.entry.slice(0, -1);
        } else if (this.entry.length < 5) {
          // A leading zero would read as "0" then "07", so ignore it.
          this.entry = this.entry === '' && key === '0' ? '' : this.entry + key;
        }
        this.sounds.tick();
        entryEl.textContent = this.entry === '' ? '?' : this.entry;
      });
      this.padKeys.push(btn);
      pad.append(btn);
    }

    this.bottomEl.append(entryEl, pad);
    this.notifyLayout();
  }

  /**
   * Grey the pad out without unmounting it.
   *
   * Removing the pad between pieces changed the HUD's height twice per answer,
   * which made the cubes zoom in and back out every time — and left a window
   * where the camera was framed for a screen with no pad while the pad was
   * back on it. Keeping it mounted keeps the layout still.
   */
  setPadEnabled(enabled: boolean) {
    for (const key of this.padKeys) {
      key.disabled = !enabled;
      key.classList.toggle('cf-off', !enabled);
    }
  }

  /** Empty the typed digits without rebuilding the pad. */
  clearEntry() {
    this.entry = '';
    if (this.entryEl) this.entryEl.textContent = '?';
  }

  /** Wobble the entry box — a wrong answer, or a tick with nothing typed. */
  shake() {
    const el = this.entryEl;
    if (!el) return;
    el.classList.remove('cf-shake');
    // Reading offsetWidth restarts the animation instead of ignoring the re-add.
    void el.offsetWidth;
    el.classList.add('cf-shake');
  }

  /**
   * Two +/- rows and a build button, for hunting factor pairs. The numbers
   * update live so the kid feels the rectangle change before committing.
   */
  showSteppers(
    init: { rows: number; cols: number },
    opts: {
      max: number;
      onChange: (rows: number, cols: number) => void;
      onBuild: (rows: number, cols: number) => void;
    },
  ): StepperHandle {
    this.clearBottom();
    let rows = init.rows;
    let cols = init.cols;

    const rowValue = div('cf-step__value');
    const colValue = div('cf-step__value');

    const paint = () => {
      rowValue.textContent = String(rows);
      colValue.textContent = String(cols);
    };

    // Every control here is greyed out together while a build is running.
    const controls: HTMLButtonElement[] = [];

    const button = (label: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cf-step__btn';
      b.textContent = label;
      b.addEventListener('click', () => {
        if (b.disabled) return;
        onClick();
        paint();
        this.sounds.tick();
        opts.onChange(rows, cols);
      });
      controls.push(b);
      return b;
    };

    const makeRow = (label: string, valueEl: HTMLDivElement, step: (delta: number) => void) => {
      const wrap = div('cf-step');
      const name = div('cf-step__label');
      name.textContent = label;
      wrap.append(name, button('−', () => step(-1)), valueEl, button('+', () => step(1)));
      return wrap;
    };

    const clamp = (v: number) => Math.min(opts.max, Math.max(1, v));

    const rowsRow = makeRow('Rows', rowValue, (d) => {
      rows = clamp(rows + d);
    });
    const colsRow = makeRow('Columns', colValue, (d) => {
      cols = clamp(cols + d);
    });

    const build = document.createElement('button');
    build.type = 'button';
    build.className = 'cf-btn cf-btn--primary';
    build.textContent = 'Build it!';
    build.addEventListener('click', () => {
      if (build.disabled) return;
      opts.onBuild(rows, cols);
    });
    controls.push(build);

    paint();
    this.bottomEl.append(rowsRow, colsRow, build);
    this.notifyLayout();

    return {
      set: (r, c) => {
        rows = clamp(r);
        cols = clamp(c);
        paint();
        opts.onChange(rows, cols);
      },
      setEnabled: (enabled) => {
        for (const control of controls) {
          control.disabled = !enabled;
          control.classList.toggle('cf-off', !enabled);
        }
      },
    };
  }

  hideControls() {
    this.clearBottom();
    this.notifyLayout();
  }

  /**
   * A full-screen card: level picker, level complete, well done.
   * Returns the body element so the caller can wire up anything inside it.
   */
  showPanel(opts: {
    title: string;
    bodyHtml?: string;
    buttons: PanelButton[];
  }): HTMLDivElement | null {
    this.panelEl.replaceChildren();

    const title = div('cf-panel__title');
    title.textContent = opts.title;
    this.panelEl.append(title);

    let body: HTMLDivElement | null = null;
    if (opts.bodyHtml) {
      body = div('cf-panel__body');
      // Only ever this game's own markup — nothing here comes from outside.
      body.innerHTML = opts.bodyHtml;
      this.panelEl.append(body);
    }

    const row = div('cf-panel__buttons');
    for (const spec of opts.buttons) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = spec.primary ? 'cf-btn cf-btn--primary' : 'cf-btn';
      b.textContent = spec.label;
      b.addEventListener('click', () => {
        this.sounds.tick();
        spec.onClick();
      });
      row.append(b);
    }
    this.panelEl.append(row);
    this.panelEl.hidden = false;
    return body;
  }

  hidePanel() {
    this.panelEl.hidden = true;
    this.panelEl.replaceChildren();
  }

  dispose() {
    window.clearTimeout(this.toastTimer);
    this.root.remove();
    this.styleEl.remove();
  }

  private clearBottom() {
    this.bottomEl.replaceChildren();
    this.entryEl = null;
    this.entry = '';
    this.padKeys = [];
  }

  private notifyLayout() {
    this.onLayout?.();
  }
}

/** "★★☆" for 2 of 3. */
export function starsText(count: number, total = 3): string {
  return '★'.repeat(count) + '☆'.repeat(Math.max(0, total - count));
}

function div(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

const CSS = `
.cf-root {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  color: #fff;
  font-family: inherit;
  text-align: center;
}
.cf-spacer { flex: 1; }

/* 88px clears the shell's back button, whatever the screen width. */
.cf-top { margin-top: 88px; padding: 0 16px; }
.cf-question {
  font-size: clamp(2rem, 8vw, 4rem);
  font-weight: 900;
  line-height: 1.1;
  text-shadow: 0 4px 0 rgba(0, 0, 0, 0.35);
}
.cf-question--long {
  font-size: clamp(1.3rem, 4.6vw, 2.3rem);
}
.cf-sub {
  font-size: clamp(0.95rem, 3.4vw, 1.45rem);
  font-weight: 700;
  opacity: 0.92;
  margin-top: 6px;
}
.cf-tally {
  display: inline-block;
  margin-top: 10px;
  padding: 6px 18px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.38);
  font-size: clamp(1rem, 3.6vw, 1.6rem);
  font-weight: 800;
}

.cf-bottom {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 0 16px 20px;
}
.cf-entry {
  min-width: 150px;
  padding: 2px 22px;
  border-radius: 18px;
  background: #fff;
  color: #2b2b3a;
  font-size: clamp(1.9rem, 7vw, 3rem);
  font-weight: 900;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.25);
}
.cf-pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: min(320px, 84vw);
  pointer-events: auto;
}
.cf-key {
  font: inherit;
  font-size: 1.85rem;
  font-weight: 900;
  min-height: 58px;
  border: none;
  border-radius: 16px;
  background: #fff;
  color: #2b2b3a;
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.28);
  cursor: pointer;
}
.cf-key:active { transform: translateY(3px); box-shadow: 0 2px 0 rgba(0, 0, 0, 0.28); }
.cf-key--go { background: #6bcb77; color: #fff; }
.cf-key--del { background: #ffd93d; }

.cf-step {
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
}
.cf-step__label { font-size: 1.25rem; font-weight: 800; min-width: 110px; text-align: right; }
.cf-step__value {
  min-width: 62px;
  font-size: 2rem;
  font-weight: 900;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 14px;
  padding: 2px 10px;
}
.cf-step__btn {
  font: inherit;
  font-size: 1.8rem;
  font-weight: 900;
  width: 58px;
  min-height: 58px;
  border: none;
  border-radius: 50%;
  background: #fff;
  color: #2b2b3a;
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.28);
  cursor: pointer;
}
.cf-step__btn:active { transform: translateY(3px); box-shadow: 0 2px 0 rgba(0, 0, 0, 0.28); }

.cf-btn {
  font: inherit;
  font-size: 1.35rem;
  font-weight: 900;
  border: none;
  border-radius: 999px;
  padding: 15px 32px;
  min-height: 58px;
  background: rgba(255, 255, 255, 0.9);
  color: #2b2b3a;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.3);
  cursor: pointer;
  pointer-events: auto;
}
.cf-btn--primary { background: #ffd93d; }
.cf-btn:active { transform: translateY(3px); box-shadow: 0 3px 0 rgba(0, 0, 0, 0.3); }

/* A slot in the top block that is always reserved, so the celebration can never
   cover the sum, a block label, or the cubes — and its arrival never changes
   the HUD's height. */
.cf-toast {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  margin-top: 8px;
  padding: 0 26px;
  border-radius: 22px;
  background: rgba(8, 12, 32, 0.84);
  font-size: clamp(1.4rem, 5vw, 2.2rem);
  font-weight: 900;
  opacity: 0;
  transform: scale(0.6);
  text-shadow: 0 3px 0 rgba(0, 0, 0, 0.35);
  transition: opacity 0.18s ease, transform 0.18s ease;
  pointer-events: none;
  white-space: nowrap;
}
.cf-toast--show { opacity: 1; transform: scale(1); }
.cf-toast--good { color: #9ee37d; }
.cf-toast--bad { color: #ffd93d; }

.cf-panel {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 24px;
  background: rgba(10, 14, 35, 0.88);
  pointer-events: auto;
  overflow-y: auto;
}
.cf-panel__title { font-size: clamp(1.7rem, 7vw, 3rem); font-weight: 900; }
.cf-panel__body { font-size: clamp(1rem, 3.6vw, 1.4rem); font-weight: 700; line-height: 1.5; }
.cf-panel__buttons { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; }

.cf-levels { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
.cf-level {
  font: inherit;
  width: 220px;
  border: none;
  border-radius: 24px;
  padding: 20px 16px;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 8px 0 rgba(0, 0, 0, 0.25);
  text-align: center;
}
.cf-level:active { transform: translateY(3px); box-shadow: 0 5px 0 rgba(0, 0, 0, 0.25); }
.cf-level__emoji { font-size: 3rem; }
.cf-level__name { font-size: 1.3rem; font-weight: 900; margin-top: 6px; }
.cf-level__what { font-size: 0.95rem; font-weight: 700; opacity: 0.92; margin-top: 4px; }
.cf-level__stars { font-size: 1.5rem; margin-top: 8px; color: #ffd93d; }

.cf-trophies {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 10px;
  padding: 0 12px;
}
.cf-off { opacity: 0.45; }

.cf-bigstars {
  font-size: clamp(2.5rem, 12vw, 5rem);
  color: #ffd93d;
  line-height: 1.1;
}

.cf-trophy {
  background: rgba(255, 217, 61, 0.22);
  border: 2px solid #ffd93d;
  border-radius: 14px;
  padding: 6px 14px;
  font-size: 1.2rem;
  font-weight: 900;
}

.cf-shake { animation: cf-shake 0.4s ease; }
@keyframes cf-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-9px); }
  75% { transform: translateX(9px); }
}

/* On a landscape screen the pad was eating 45% of the height and squeezing the
   cubes into a strip. Phones are portrait, so this leaves them alone. */
@media (min-aspect-ratio: 1/1) {
  .cf-pad { width: min(272px, 34vw); gap: 8px; }
  .cf-key { min-height: 46px; font-size: 1.5rem; border-radius: 13px; }
  .cf-entry { font-size: clamp(1.4rem, 4vw, 2.1rem); min-width: 130px; }
  .cf-bottom { gap: 7px; padding-bottom: 14px; }
  .cf-top { margin-top: 74px; }
  .cf-step__btn { width: 50px; min-height: 50px; font-size: 1.6rem; }
  .cf-step__value { font-size: 1.7rem; }
}

@media (prefers-reduced-motion: reduce) {
  .cf-shake { animation: none; }
  .cf-toast { transition: none; }
}
`;
