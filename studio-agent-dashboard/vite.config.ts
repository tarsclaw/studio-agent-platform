import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const hubBase = env.VITE_HUB_API_BASE || 'https://bot16fddc.azurewebsites.net';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: hubBase,
          changeOrigin: true,
          secure: hubBase.startsWith('https://'),
        },
      },
    },
  };
});
