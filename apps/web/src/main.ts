import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router/index';
import './styles/main.css';
import './styles/vant-theme.css';

createApp(App).use(createPinia()).use(router).mount('#app');
