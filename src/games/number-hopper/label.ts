import * as THREE from 'three';

/**
 * Text in the 3D scene, without shipping a font.
 *
 * three.js can only draw text from a loaded typeface, and this project has no
 * asset pipeline, so numbers are painted onto a 2D canvas and used as a
 * texture. The result is a sprite: always facing the camera, which is exactly
 * what a number on a signpost should do.
 */

export interface LabelOptions {
  /** World height of the sprite. Width follows the text. */
  size?: number;
  color?: string;
  /** Filled rounded plate behind the text. Omit for bare text. */
  background?: string;
  bold?: boolean;
}

/** A sprite showing `text`, plus the GPU resources it owns. */
export interface Label {
  sprite: THREE.Sprite;
  /** Repaint with new text, reusing the same canvas and texture. */
  setText(text: string): void;
  dispose(): void;
}

/**
 * Canvas size, fixed for the lifetime of a label and wide enough for "100".
 *
 * It must never change. Resizing a canvas that is already backing a GPU
 * texture leaves the old pixels on screen — `needsUpdate` re-uploads the
 * contents but the stale dimensions win, so a label that grew from "0" to "35"
 * kept showing "0" forever. Drawing into a fixed canvas and letting the plate
 * shrink-wrap the text instead avoids the whole problem.
 */
const CANVAS_W = 320;
const CANVAS_H = 112;

export function makeLabel(text: string, options: LabelOptions = {}): Label {
  const { size = 1, color = '#2b2b3a', background, bold = true } = options;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const g = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  // Sprites are viewed at an angle down the road; without this, distant
  // labels shimmer badly.
  texture.anisotropy = 4;
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  // Fixed canvas means a fixed sprite aspect: set once, never per repaint.
  sprite.scale.set((CANVAS_W / CANVAS_H) * size, size, 1);

  function paint(next: string) {
    if (!g) return;
    const fontPx = Math.round(CANVAS_H * 0.62);
    const font = `${bold ? '800 ' : ''}${fontPx}px 'Comic Sans MS', 'Chalkboard SE', 'Trebuchet MS', sans-serif`;

    g.clearRect(0, 0, CANVAS_W, CANVAS_H);
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';

    const cx = CANVAS_W / 2;
    const cy = CANVAS_H * 0.54;

    if (background) {
      // The plate hugs the text rather than filling the canvas, so a "5" gets
      // a small badge and "100" a wide one.
      const textW = g.measureText(next).width;
      const plateW = Math.min(CANVAS_W, textW + fontPx * 1.0);
      const plateH = CANVAS_H * 0.86;
      const r = plateH * 0.4;
      g.fillStyle = background;
      g.beginPath();
      g.roundRect(cx - plateW / 2, (CANVAS_H - plateH) / 2, plateW, plateH, r);
      g.fill();
    } else {
      // A halo instead of a plate: keeps bare numbers readable against both
      // the light road and the dark grass.
      g.lineWidth = fontPx * 0.16;
      g.strokeStyle = 'rgba(255,255,255,0.92)';
      g.lineJoin = 'round';
      g.strokeText(next, cx, cy);
    }

    g.fillStyle = color;
    g.fillText(next, cx, cy);

    texture.needsUpdate = true;
  }

  paint(text);

  return {
    sprite,
    setText: paint,
    dispose() {
      texture.dispose();
      material.dispose();
    },
  };
}
