import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@webnativellc/simple-plist': path.resolve(__dirname, 'node_modules/@webnativellc/simple-plist/dist/index.cjs'),
    },
  },
});
