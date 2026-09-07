import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The browser journey and the live Workers AI bakeoff have their own configs
    // and run via `npm run test:browser` / `npm run test:live`.
    exclude: ['tests/browser/**', 'tests/live/**']
  }
});
