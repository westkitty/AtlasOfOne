import { defineConfig } from 'vitest/config';

/**
 * Browser-runtime journey. Kept out of `npm test` so the unit suite stays fast
 * and hermetic; run it with `npm run test:browser` after a production build.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/browser/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    sequence: { concurrent: false }
  }
});
