import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@/components': path.resolve(__dirname, 'src/components'),
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      host: '127.0.0.1',
      allowedHosts: ['127.0.0.1', 'localhost'],
      watch: { ignored: ['**/data/**'] }
    },
    test: {
      // В .claude/worktrees лежат копии репозитория для параллельных сессий
      // агента. Без этого их тесты попадают в общий прогон, и счёт врёт.
      exclude: [...configDefaults.exclude, '.claude/**'],
    },
  };
});
