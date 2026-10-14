import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        work: resolve(__dirname, 'work/index.html'),
        workFintech: resolve(__dirname, 'work/fintech-realtime-dashboard.html'),
        workNeural: resolve(__dirname, 'work/neural-canvas-studio.html'),
        workCloud: resolve(__dirname, 'work/cloud-infra-orchestrator.html'),
      },
    },
  },
});
