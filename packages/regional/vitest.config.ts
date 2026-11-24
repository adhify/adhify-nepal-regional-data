import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'regional',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Bundles the synthetic fixtures into src/bundle before any test runs.
    globalSetup: ['./scripts/vitest-global-setup.ts'],
  },
});
