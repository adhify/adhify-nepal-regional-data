import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'release-format',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
