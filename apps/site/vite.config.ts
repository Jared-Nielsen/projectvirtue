import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

// Marketing site — plain Vite + Solid + custom SSG prerender.
// (Solid Start was evaluated and deliberately rejected; see README.md.)
export default defineConfig(({ ssrBuild }) => ({
  plugins: [solid({ ssr: ssrBuild === true })],
  server: {
    port: 5174,
    strictPort: false,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Emit manifest so the prerender step can resolve hashed asset URLs.
    manifest: true,
    rollupOptions: {
      // SSR build is invoked separately with `--ssr src/entry-server.tsx`;
      // the default client build keeps the SPA entry from index.html.
      output: ssrBuild
        ? { format: 'esm' }
        : undefined,
    },
  },
  ssr: {
    // Solid + @br/* sources are TS — bundle them into the SSR output rather
    // than treating them as externals (default Vite SSR externalises node_modules).
    noExternal: ['solid-js', '@solidjs/router', /^@br\//],
  },
}));
