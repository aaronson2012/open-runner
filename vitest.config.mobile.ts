/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'Mobile Tests',
    include: [
      'tests/mobile/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/unit/**/*/mobile*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/performance/**/*mobile*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'node_modules/**',
      'dist/**'
    ],
    environment: 'happy-dom',
    setupFiles: [
      './tests/performance/setup-performance.ts',
      './tests/mobile/setup-mobile.ts'
    ],
    testTimeout: 45000, // 45 seconds for mobile simulation
    hookTimeout: 20000,
    teardownTimeout: 15000,
    reporters: [
      'default',
      ['json', { outputFile: 'test-results/mobile/results.json' }],
      ['html', { outputFile: 'coverage/mobile-report.html' }]
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage/mobile',
      include: [
        'src/performance/optimizers/MobileOptimizer.ts',
        'src/systems/**/*mobile*',
        'src/components/**/*mobile*',
        'src/utils/mobile/**'
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.d.ts'
      ],
      thresholds: {
        statements: 65,
        branches: 60,
        functions: 65,
        lines: 65
      }
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true // Mobile tests need isolated environment
      }
    },
    env: {
      MOBILE_TEST_MODE: 'true',
      SIMULATE_LOW_END: 'true',
      BATTERY_TEST: 'true',
      THERMAL_TEST: 'true'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  define: {
    'import.meta.vitest': undefined,
    __MOBILE_TEST__: true,
    __LOW_END_DEVICE__: true,
    __BATTERY_SIMULATION__: true
  }
});