import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/open-runner/' : '/',
  server: { open: true },
}));


