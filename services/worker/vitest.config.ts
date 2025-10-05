import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    timeout: 30_000
  },
  resolve: {
    alias: {
      '@local-office/db': resolve(rootDir, 'tests/stubs/db.ts'),
      '@local-office/lib': resolve(rootDir, '../../packages/lib/src/index.ts'),
      '@local-office/labeler': resolve(rootDir, '../labeler/src/index.ts')
    }
  }
});
