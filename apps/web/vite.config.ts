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
          theme_color: '#FFE28A',
          background_color: '#FFFDF8',
          icons: [
            { src: '/icons/app-icon-192-v1.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/app-icon-512-v1.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/app-icon-maskable-512-v1.png',
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
      allowedHosts: ['shiro-windows', 'shiro-mac-home', '.ts.net'],
      proxy: { '/api': env.API_PROXY_TARGET || 'http://127.0.0.1:3000' },
    },
  };
});
