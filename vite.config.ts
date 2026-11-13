import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — сайт живёт на GitHub Pages в подпапке /bar_prep/, относительные пути работают везде
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    // картинки и шрифты — отдельными файлами: браузер их кеширует между запусками
    assetsInlineLimit: 0,
  },
  server: { host: true },
});
