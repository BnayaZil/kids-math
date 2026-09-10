/** The factory's look: colours and cube sizing, in one place. */

export const SCENE_BG = '#111a3d';

/** Cube colours for the array level — one per row, so rows stay tellable apart. */
export const ROW_COLORS = [
  0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xa66bff, 0xff9f45, 0x4ecdc4, 0xf06595, 0x9ee37d,
];

/** One colour per area-model block, biggest place value first. */
export const BLOCK_COLORS = [0x4d96ff, 0x6bcb77, 0xffd93d, 0xff6b6b];

/** The same four, for DOM chips that label the blocks. */
export const BLOCK_COLORS_CSS = ['#4d96ff', '#6bcb77', '#ffd93d', '#ff6b6b'];

export const TROPHY_COLOR = 0xffd93d;

/** One grid cell is 1 unit wide; the cube is smaller so the seams stay visible. */
export const CELL = 1;
export const CUBE_SIZE = 0.86;
