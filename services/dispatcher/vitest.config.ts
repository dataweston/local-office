import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      enabled: false
    }
  }
});
