import { defineConfig } from 'vitest/config';

/**
 * Live Workers AI bakeoff. Kept out of `npm test` because it needs real
 * credentials and spends the free daily neuron allocation. It skips itself
 * cleanly when no credentials are present.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/live/**/*.live.test.ts'],
    testTimeout: 1_800_000,
    hookTimeout: 1_800_000,
    fileParallelism: false,
    sequence: { concurrent: false }
  }
});
