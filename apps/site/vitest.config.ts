import { defineConfig } from 'vitest/config';

// Vitest config for unit tests in src/lib/. Astro's build/test orbit handles
// component testing; this stays jsdom + plain TS for the lib/ utilities.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/lib/**/*.test.{ts,tsx}'],
  },
});
