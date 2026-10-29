import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  base: '/wings-of-honor/',
  plugins: [cloudflare({ viteEnvironment: { name: 'worker' } })],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  environments: {
    client: {
      build: {
        target: 'es2022',
        cssMinify: true,
        modulePreload: true,
        rollupOptions: {
          input: {
            main: 'index.html',
            ops: 'ops.html',
          },
          output: {
            manualChunks(id) {
              if (id.includes('node_modules/three')) return 'three';
            },
          },
        },
      },
    },
    worker: { build: { sourcemap: true } },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
