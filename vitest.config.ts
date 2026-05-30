import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// Unit-test config. Node environment (no DOM); pure-function tests only — no DB,
// no network. `vite-tsconfig-paths` makes `@/` resolve to ./src so the real
// exports import cleanly. SKIP_ENV_VALIDATION=1 plus the default NODE_ENV=test
// makes `@/lib/env` return its stub instead of throwing on missing secrets.
//
// NOTE: no coverage thresholds — this suite is unit-only and would fail CI if it
// had to meet a whole-repo coverage bar.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    env: {
      SKIP_ENV_VALIDATION: '1',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
