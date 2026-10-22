import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'], format: ['esm'], platform: 'node',
  target: 'node22', splitting: false, clean: true, outDir: 'dist',
  noExternal: ['@cdp/contracts'],
});
