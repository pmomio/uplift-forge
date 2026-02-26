import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    pool: 'threads',
    include: [
      'test/main/**/*.test.ts',
      'src/renderer/**/*.test.{ts,tsx}',
      'test/renderer/**/*.test.{ts,tsx}',
    ],
    environment: 'jsdom',
    setupFiles: './src/renderer/test-setup.ts',
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/main/services/**/*.ts',
        'src/renderer/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/renderer/test-setup.ts',
        'src/renderer/**/*.test.{ts,tsx}',
        'src/renderer/main.tsx',
        'src/renderer/electron.d.ts',
        'src/main/index.ts',
        'src/main/preload.ts',
        'src/main/auth/**',
        'src/main/ipc/**',
      ],
      thresholds: { statements: 90, branches: 80, functions: 85, lines: 90 },
    },
  },
});
