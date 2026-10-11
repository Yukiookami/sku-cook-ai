import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { AxiosError, type AxiosAdapter } from 'axios';
import { ApiErrorResponseSchema, AuthResponseSchema, type AuthUser } from '@sku-cook/shared';
import AccountMenu from '../components/common/AccountMenu.vue';
import AccountView from '../views/account/AccountView.vue';
import { client, setUnauthorizedHandler } from '../api/client';
import {
  deleteAccountSession,
  getAccountSession,
  loginAccount,
  registerAccount,
} from '../api/auth';
import { ensureAccountSession, resetAccountSessionForTests, setCurrentAccount } from './session';
import { handleUnauthorized } from './unauthorized';
import { router } from '../router';

const originalAdapter = client.defaults.adapter;
const user: AuthUser = { id: 42, username: 'Sku001' };
const validPassword = 'A'.repeat(12);
let calls: { method: string; url: string; data: unknown; withCredentials: boolean }[] = [];
let respond: (url: string, method: string) => { status: number; data: unknown };
let globalUnauthorized: ReturnType<typeof vi.fn>;

const adapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toLowerCase();
  const url = config.url ?? '';
  const result = respond(url, method);
  calls.push({
    method,
    url,
    data: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
    withCredentials: config.withCredentials ?? false,
  });
  const response = {
    data: result.data,
    status: result.status,
    statusText: result.status === 204 ? 'No Content' : 'OK',
    headers: {},
    config,
  };
  if (result.status >= 400) {
    throw new AxiosError('request failed', AxiosError.ERR_BAD_REQUEST, config, undefined, response);
  }
  return response;
};

function sessionResponse() {
  return AuthResponseSchema.parse({ user });
}

beforeEach(async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  calls = [];
  globalUnauthorized = vi.fn(() => handleUnauthorized(router));
  setUnauthorizedHandler(globalUnauthorized);
  respond = () => ({ status: 200, data: sessionResponse() });
  client.defaults.adapter = adapter;
  resetAccountSessionForTests();
  await router.replace('/account');
});

afterEach(() => {
  setUnauthorizedHandler(undefined);
  client.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe('account API and session guard', () => {
  it('uses shared schemas, cookie credentials, and the agreed auth routes', async () => {
    await registerAccount(user.username, validPassword, 'alice@example.com');
    await loginAccount(user.username, validPassword);
    await getAccountSession();
    respond = () => ({ status: 204, data: undefined });
    await deleteAccountSession();

    expect(calls.map(({ method, url }) => [method, url])).toEqual([
      ['post', '/auth/register'],
      ['post', '/auth/login'],
      ['get', '/auth/session'],
      ['delete', '/auth/session'],
    ]);
    expect(calls.slice(0, 2).map(({ data }) => data)).toEqual([
      { username: user.username, password: validPassword, email: 'alice@example.com' },
      { username: user.username, password: validPassword },
    ]);
    expect(calls.every(({ withCredentials }) => withCredentials)).toBe(true);
  });

  it('redirects an unauthenticated deep link on session 401 and returns after login', async () => {
    respond = (url) =>
      url === '/auth/session'
        ? {
            status: 401,
            data: ApiErrorResponseSchema.parse({
              error: { code: 'UNAUTHORIZED', message: '请登录' },
            }),
          }
        : { status: 200, data: sessionResponse() };

    await router.push('/kitchen');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('account');
    expect(router.currentRoute.value.query.redirect).toBe('/kitchen');
    expect(calls.map(({ url }) => url)).toEqual(['/auth/session']);
    expect(globalUnauthorized).not.toHaveBeenCalled();

    const wrapper = mount(AccountView, { global: { plugins: [router] } });
    await wrapper.get('input[name="username"]').setValue(user.username);
    await wrapper.get('input[name="password"]').setValue(validPassword);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(calls.map(({ method, url }) => [method, url])).toEqual([
      ['get', '/auth/session'],
      ['post', '/auth/login'],
    ]);
    expect(router.currentRoute.value.fullPath).toBe('/kitchen');
    wrapper.unmount();
  });

  it('allows open registration and starts an authenticated session on success', async () => {
    await router.replace({ name: 'account', query: { mode: 'register' } });
    const wrapper = mount(AccountView, { global: { plugins: [router] } });
    await wrapper.get('input[name="username"]').setValue(user.username);
    await wrapper.get('input[name="password"]').setValue(validPassword);
    await wrapper.get('input[name="email"]').setValue('alice@example.com');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(calls.map(({ method, url }) => [method, url])).toEqual([['post', '/auth/register']]);
    expect(router.currentRoute.value.path).toBe('/recipes');
    wrapper.unmount();
  });

  it('protects all existing business routes from unauthenticated entry', async () => {
    respond = (url) =>
      url === '/auth/session'
        ? { status: 401, data: { error: { code: 'UNAUTHORIZED', message: '请登录' } } }
        : { status: 200, data: sessionResponse() };
    for (const path of [
      '/recipes',
      '/recipes/new',
      '/recipes/import',
      '/recipes/import/excel',
      '/recipes/3',
      '/recipes/3/edit',
      '/kitchen',
      '/cooking-history',
    ]) {
      resetAccountSessionForTests();
      await router.push(path);
      await flushPromises();
      expect(router.currentRoute.value.name, path).toBe('account');
      expect(router.currentRoute.value.query.redirect, path).toBe(path);
    }
  });

  it('does not allow protected content when session verification is unavailable', async () => {
    respond = () => {
      throw new Error('network unavailable');
    };
    await router.push('/cooking-history');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('account');
    expect(router.currentRoute.value.query.session).toBe('unavailable');
    expect(router.currentRoute.value.query.redirect).toBe('/cooking-history');
  });

  it('restores the logged-in user from the server session after a page refresh', async () => {
    await router.push('/recipes');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('recipe-list');
    expect(calls.map(({ method, url }) => [method, url])).toEqual([['get', '/auth/session']]);
    await expect(ensureAccountSession()).resolves.toEqual(user);
  });

  it('keeps login failures on the account page without running the business 401 handler', async () => {
    respond = () => ({
      status: 401,
      data: { error: { code: 'INVALID_CREDENTIALS', message: '账号或密码不正确' } },
    });
    const wrapper = mount(AccountView, { global: { plugins: [router] } });
    await wrapper.get('input[name="username"]').setValue(user.username);
    await wrapper.get('input[name="password"]').setValue(validPassword);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('account');
    expect(wrapper.get('[role="alert"]').text()).toContain('账号或密码不正确');
    expect(globalUnauthorized).not.toHaveBeenCalled();
    expect(calls.map(({ method, url }) => [method, url])).toEqual([['post', '/auth/login']]);
    wrapper.unmount();
  });

  it('expires local account state and navigates to login after a business API 401', async () => {
    setCurrentAccount(user);
    await router.push('/recipes');
    respond = () => ({
      status: 401,
      data: { error: { code: 'UNAUTHORIZED', message: '请登录' } },
    });

    await expect(client.get('/recipes')).rejects.toBeInstanceOf(AxiosError);
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('account');
    expect(router.currentRoute.value.query.redirect).toBe('/recipes');
    expect(globalUnauthorized).toHaveBeenCalledOnce();
    expect(await ensureAccountSession()).toBeNull();
  });
});

describe('account form and menu interactions', () => {
  it('switches between registration and login without discarding the username', async () => {
    const wrapper = mount(AccountView, { global: { plugins: [router] } });
    await wrapper.get('input[name="username"]').setValue(user.username);
    await wrapper.get('.account-switch button').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.query.mode).toBe('register');
    expect(wrapper.text()).toContain('创建账号');
    expect((wrapper.get('input[name="username"]').element as HTMLInputElement).value).toBe(
      user.username,
    );
    wrapper.unmount();
  });

  it('keeps the username and shows the server error when registration fails', async () => {
    respond = () => ({
      status: 409,
      data: { error: { code: 'USERNAME_TAKEN', message: '该用户名已被使用' } },
    });
    await router.replace({ name: 'account', query: { mode: 'register' } });
    const wrapper = mount(AccountView, { global: { plugins: [router] } });
    await wrapper.get('input[name="username"]').setValue(user.username);
    await wrapper.get('input[name="password"]').setValue(validPassword);
    await wrapper.get('input[name="email"]').setValue('alice@example.com');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(calls.map(({ method, url }) => [method, url])).toEqual([['post', '/auth/register']]);
    expect(wrapper.get('[role="alert"]').text()).toContain('该用户名已被使用');
    expect((wrapper.get('input[name="username"]').element as HTMLInputElement).value).toBe(
      user.username,
    );
    wrapper.unmount();
  });

  it('rejects invalid input from the shared credential schema before making a request', async () => {
    const wrapper = mount(AccountView, { global: { plugins: [router] } });
    await wrapper.get('input[name="username"]').setValue('x');
    await wrapper.get('input[name="password"]').setValue('short');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(calls).toHaveLength(0);
    expect(wrapper.get('[role="alert"]').text()).toBeTruthy();
    wrapper.unmount();
  });

  it('logs out only after DELETE succeeds and navigates to the login page', async () => {
    setCurrentAccount(user);
    await router.push('/recipes');
    const wrapper = mount(AccountMenu, { global: { plugins: [router] } });
    wrapper.element.querySelector('details')?.setAttribute('open', '');
    respond = () => ({ status: 204, data: undefined });
    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(calls.map(({ method, url }) => [method, url])).toEqual([['delete', '/auth/session']]);
    expect(router.currentRoute.value.name).toBe('account');
    wrapper.unmount();
  });

  it('retains the current session and reports an error when logout fails', async () => {
    setCurrentAccount(user);
    await router.push('/recipes');
    const wrapper = mount(AccountMenu, { global: { plugins: [router] } });
    wrapper.element.querySelector('details')?.setAttribute('open', '');
    respond = () => ({
      status: 503,
      data: { error: { code: 'SERVICE_UNAVAILABLE', message: '暂时无法退出，请重试' } },
    });
    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/recipes');
    expect(wrapper.get('[role="alert"]').text()).toContain('暂时无法退出，请重试');
    wrapper.unmount();
  });
});
