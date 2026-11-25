import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths, so the build also runs from a sub-path, e.g. inside
  // itch.io's iframe (html-classic.itch.zone/html/<id>/index.html).
  base: './',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
