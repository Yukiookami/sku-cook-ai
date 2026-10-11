import type { Router } from 'vue-router';
import { clearCurrentAccount } from './session';

export function handleUnauthorized(router: Router): void {
  const isProtectedRoute = router.currentRoute.value.meta.requiresAuth === true;
  const redirect = isProtectedRoute ? router.currentRoute.value.fullPath : undefined;
  clearCurrentAccount();
  if (redirect) void router.replace({ name: 'account', query: { redirect } });
}
