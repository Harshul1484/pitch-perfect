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
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    css: true,
  },
});
