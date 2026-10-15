import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
  },
  plugins: [
    {
      name: 'api-contact-mock',
      configureServer(server) {
        server.middlewares.use('/api/contact', (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, message: 'Message received!' }));
            });
            return;
          }
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
        });
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        auth: resolve(__dirname, 'auth.html'),
        work: resolve(__dirname, 'work/index.html'),
        workFintech: resolve(__dirname, 'work/fintech-realtime-dashboard.html'),
        workNeural: resolve(__dirname, 'work/neural-canvas-studio.html'),
        workCloud: resolve(__dirname, 'work/cloud-infra-orchestrator.html'),
      },
    },
  },
});
