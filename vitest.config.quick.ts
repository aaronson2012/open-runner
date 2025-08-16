import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'quick',
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/unit/**/*.{test,spec}.{js,ts}',
      'src/**/*.{test,spec}.{js,ts}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/integration/**',
      '**/performance/**',
      // Exclude slow tests
      '**/*.slow.{test,spec}.{js,ts}',
      '**/*.e2e.{test,spec}.{js,ts}',
    ],
    globals: true,
    testTimeout: 3000, // Short timeout for quick feedback
    hookTimeout: 2000,
    teardownTimeout: 500,
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 2,
        maxThreads: 6, // Use more threads for faster execution
      },
    },
    reporters: ['dot'], // Minimal output for speed
    // Skip coverage for quick tests
    coverage: {
      enabled: false,
    },
    // Only run tests that are marked as quick or have no specific tags
    testNamePattern: '(?!.*@slow).*',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@assets': resolve(__dirname, 'public/assets'),
      '@components': resolve(__dirname, 'src/components'),
      '@core': resolve(__dirname, 'src/core'),
      '@systems': resolve(__dirname, 'src/systems'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@types': resolve(__dirname, 'src/types'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GITHUB_PAGES__: JSON.stringify(false),
    __BASE_PATH__: JSON.stringify('/'),
    __QUICK_MODE__: JSON.stringify(true),
  },
});