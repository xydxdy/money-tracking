import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['dotenv/config', './tests/setup-env.ts'],
    // DB-touching test files share one Postgres test database and several
    // suites perform unscoped cleanup (e.g. `db.delete(accounts)` for all
    // rows, not just their own). Running test files in parallel lets one
    // suite's teardown delete rows another suite's beforeAll just inserted.
    // Disabling file parallelism keeps suites sequential and isolated.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
});
