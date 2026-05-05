import sitemap from '@astrojs/sitemap';
import solid from '@astrojs/solid-js';
import { defineConfig } from 'astro/config';

// Project Virtue marketing site — Astro static build with Solid islands.
// See README.md for the framework decision history.
export default defineConfig({
  site: 'https://virtu3.com',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
  integrations: [solid(), sitemap()],
  vite: {
    ssr: {
      // Solid + @br/* sources are TS — bundle them rather than treating them
      // as externals (default Vite SSR externalises node_modules).
      noExternal: [/^@br\//],
    },
  },
});
