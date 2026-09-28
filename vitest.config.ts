import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['dotenv/config', './tests/setup-env.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
});
