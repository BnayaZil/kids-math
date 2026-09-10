# 🧮 Math Playground

A collection of kids' math mini-games (ages 7–10) built with [three.js](https://threejs.org/),
Vite, and vanilla TypeScript. No frameworks, no network, no paid assets — three.js
primitives, CSS, and emoji only.

## Run it

```bash
npm install
npm run dev      # local dev server with hot reload
npm run build    # type-check + production build into dist/
npm run preview  # serve the built dist/ locally
```

Open the URL Vite prints. You land on the menu; tap a colorful card to play,
tap **← Menu** to come back.

## How to add a game (the registry contract)

Each game lives in its own directory and plugs in with **one line**. Two games
can be built in parallel without touching each other.

1. Make `src/games/<your-id>/index.ts` exporting a factory:

   ```ts
   import type { GameContext, GameInstance } from '../../shell/types';

   export function createMyGame(ctx: GameContext): GameInstance {
     // ctx: scene, camera, renderer, input (taps + pick), overlay, width, height.
     // Add 3D objects to ctx.scene; append HTML controls (buttons, number pads)
     // to ctx.overlay — the shell positions and clears it for you.
     return {
       update(dt, elapsed) { /* per-frame animation */ },
       dispose() { /* remove your listeners; the shell frees scene GPU memory */ },
     };
   }
   ```

2. In `src/games/index.ts`, import your factory and add one entry:

   ```ts
   { id: 'my-game', title: 'My Game', grade: '3rd grade', color: '#a66bff', emoji: '⭐', create: createMyGame },
   ```

That's it — the menu card and menu ⇄ game switching are handled by the shell.
An entry without `create` shows as a "coming soon" card.

## Layout

- `src/shell/` — renderer/camera bootstrap, render loop, input, menu⇄game host. Shared by all games.
- `src/games/<id>/` — one directory per game.
- `src/games/index.ts` — the registry (one line per game).
- `src/menu/` — the home menu cards.
