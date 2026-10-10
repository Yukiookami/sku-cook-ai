import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa';

const manifest: Partial<ManifestOptions> = {
  name: '吃什么饭',
  short_name: '吃什么饭',
  lang: 'zh-CN',
  start_url: '/',
  scope: '/',
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
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '');
  return {
    plugins: [
      vue(),
      {
        name: 'development-web-app-manifest',
        apply: 'serve',
        transformIndexHtml() {
          return [
            {
              tag: 'link',
              attrs: { rel: 'manifest', href: '/manifest.webmanifest' },
              injectTo: 'head',
            },
          ];
        },
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            if (request.url?.split('?')[0] !== '/manifest.webmanifest') return next();
            response.setHeader('Content-Type', 'application/manifest+json');
            response.setHeader('Cache-Control', 'no-store');
            response.end(JSON.stringify(manifest));
          });
        },
      },
      VitePWA({
        registerType: 'prompt',
        manifest,
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
