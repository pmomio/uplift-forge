import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/renderer/test-setup.ts',
    css: false,
    pool: 'threads',
    include: ['src/renderer/**/*.test.{ts,tsx}', 'test/renderer/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/renderer/**/*.{ts,tsx}'],
      exclude: [
        'src/renderer/test-setup.ts',
        'src/renderer/**/*.test.{ts,tsx}',
        'src/renderer/main.tsx',
        'src/renderer/electron.d.ts',
      ],
      thresholds: { statements: 90, branches: 80, functions: 85, lines: 90 },
    },
  },
});
