import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/system/HomeView.vue';
import RecipeListView from '../views/recipes/RecipeListView.vue';
import RecipeDetailView from '../views/recipes/RecipeDetailView.vue';
import RecipeCreateView from '../views/recipes/RecipeCreateView.vue';
import RecipeEditView from '../views/recipes/RecipeEditView.vue';
import RecipeImportView from '../views/recipes/RecipeImportView.vue';
import KitchenDisplayView from '../views/kitchen/KitchenDisplayView.vue';
import CookingHistoryView from '../views/history/CookingHistoryView.vue';
import AccountView from '../views/account/AccountView.vue';
import { ensureAccountSession } from '../auth/session';

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    if (to.path === from.path && to.query !== from.query) return {};
    return { top: 0 };
  },
  routes: [
    {
      path: '/account',
      name: 'account',
      component: AccountView,
      meta: { public: true },
    },
    { path: '/', redirect: '/recipes' },
    {
      path: '/recipes',
      name: 'recipe-list',
      component: RecipeListView,
      meta: { requiresAuth: true },
    },
    {
      path: '/recipes/new',
      name: 'recipe-create',
      component: RecipeCreateView,
      meta: { requiresAuth: true },
    },
    {
      path: '/recipes/import',
      name: 'recipe-import',
      component: RecipeImportView,
      meta: { requiresAuth: true },
    },
    {
      path: '/recipes/import/excel',
      name: 'recipe-excel-import',
      component: () => import('../views/recipes/RecipeExcelImportView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/recipes/:id/edit',
      name: 'recipe-edit',
      component: RecipeEditView,
      meta: { requiresAuth: true },
    },
    {
      path: '/recipes/:id',
      name: 'recipe-detail',
      component: RecipeDetailView,
      meta: { requiresAuth: true },
    },
    {
      path: '/kitchen',
      name: 'kitchen-display',
      component: KitchenDisplayView,
      meta: { requiresAuth: true },
    },
    {
      path: '/cooking-history',
      name: 'cooking-history',
      component: CookingHistoryView,
      meta: { requiresAuth: true },
    },
    { path: '/health-check', name: 'health-check', component: HomeView },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: {
        template:
          '<main class="page empty-state paper-card"><h1>页面不存在</h1><RouterLink class="button button-primary" to="/recipes">返回菜谱</RouterLink></main>',
      },
    },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth !== true) return true;
  try {
    const user = await ensureAccountSession();
    if (user) return true;
    return {
      name: 'account',
      query: { redirect: to.fullPath },
    };
  } catch {
    return {
      name: 'account',
      query: { redirect: to.fullPath, session: 'unavailable' },
    };
  }
});
