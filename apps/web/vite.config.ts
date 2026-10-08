import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '');
  return {
    plugins: [
      vue(),
      VitePWA({
        registerType: 'prompt',
        manifest: {
          name: '吃什么饭',
          short_name: '吃什么饭',
          lang: 'zh-CN',
          start_url: '/',
          display: 'standalone',
          theme_color: '#B8502D',
          background_color: '#FDFCFA',
          icons: [
            { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,ico}'],
          navigateFallbackDenylist: [/^\/api(?:\/|$)/],
          runtimeCaching: [],
        },
      }),
    ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      proxy: { '/api': env.API_PROXY_TARGET || 'http://127.0.0.1:3000' },
    },
  };
});
