import { defineConfig } from 'vite';

// GitHub Pages serves this as a PROJECT page from
// https://bnayazil.github.io/kids-math/ — a sub-path, not the domain root.
// A production build must prefix every asset URL with that sub-path, otherwise
// every JS/CSS/asset request 404s and the page loads blank with no obvious error.
// Local dev (`npm run dev`) stays at the root, so nothing changes there.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/kids-math/' : '/',
}));
