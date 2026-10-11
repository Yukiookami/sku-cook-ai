import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router/index';
import { setUnauthorizedHandler } from './api/client';
import { handleUnauthorized } from './auth/unauthorized';
import './styles/main.css';
import './styles/vant-theme.css';

setUnauthorizedHandler(() => handleUnauthorized(router));

createApp(App).use(createPinia()).use(router).mount('#app');
