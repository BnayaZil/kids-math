import { defineConfig } from 'vite';

// base: './' keeps asset paths relative, so a build can be opened from any
// folder or served under any sub-path — handy for a local family project.
export default defineConfig({
  base: './',
});
