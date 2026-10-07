import { defineConfig } from 'vitest/config';

/** Minimum coverage, in percent, that `npm run coverage` (and CI) enforces. */
const COVERAGE_THRESHOLDS = { statements: 90, branches: 85, functions: 90, lines: 90 };

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // The entry point only wires argv to the CLI or the server; both are tested directly.
      exclude: ['src/index.ts'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: COVERAGE_THRESHOLDS,
    },
  },
});
