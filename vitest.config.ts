import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The browser journey has its own config and runs via `npm run test:browser`.
    exclude: ['tests/browser/**']
  }
});
