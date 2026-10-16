import { createApp, nextTick } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router/index';
import { setUnauthorizedHandler } from './api/client';
import { handleUnauthorized } from './auth/unauthorized';
import './styles/main.css';
import './styles/vant-theme.css';

setUnauthorizedHandler(() => handleUnauthorized(router));

const app = createApp(App).use(createPinia()).use(router);

void router
  .isReady()
  .then(async () => {
    app.mount('#app');
    await nextTick();
    window.dispatchEvent(new Event('app:startup-ready'));
  })
  .catch((error: unknown) => {
    console.error('应用启动失败', error);
    window.dispatchEvent(new Event('app:startup-failed'));
  });
