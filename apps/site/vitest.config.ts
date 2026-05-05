import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [solid()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    // vite-plugin-solid auto-injects @testing-library/jest-dom/vitest as a
    // setupFile when running vitest. The package is a transitive peer of the
    // plugin and is not directly resolvable from apps/site, which breaks the
    // test runner. Setting a setupFile whose path includes the substring
    // "jest-dom" short-circuits the auto-injection branch in the plugin.
    setupFiles: ['./vitest.jest-dom.noop.ts'],
  },
});
