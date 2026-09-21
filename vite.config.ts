import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright owns e2e/; vitest would otherwise try to run those specs.
    // Anchored at any depth, because a git worktree under .worktrees/ is a
    // whole second copy of the repo and its e2e/ is not at the root.
    // services/ have their own runners (the OMR service uses node:test).
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/services/**'],
    css: true,
  },
});
