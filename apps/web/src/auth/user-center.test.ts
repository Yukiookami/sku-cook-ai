import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { AxiosError, type AxiosAdapter } from 'axios';
import UserCenterView from '../views/account/UserCenterView.vue';
import AccountMenu from '../components/common/AccountMenu.vue';
import PageHeader from '../components/common/PageHeader.vue';
import { client } from '../api/client';
import { currentAccount, resetAccountSessionForTests, setCurrentAccount } from './session';
import { router } from '../router';

const originalAdapter = client.defaults.adapter;
let calls: { method: string; url: string; body: unknown }[];
let respond: () => Promise<{ status: number; data: unknown }>;
const adapter: AxiosAdapter = async (config) => {
  calls.push({ method: config.method ?? '', url: config.url ?? '', body: JSON.parse(config.data) });
  const result = await respond();
  const response = { ...result, statusText: '', headers: {}, config };
  if (result.status >= 400) throw new AxiosError('failed', undefined, config, undefined, response);
  return response;
};
const mountPage = () => mount(UserCenterView, { global: { plugins: [router] } });

beforeEach(async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  resetAccountSessionForTests();
  setCurrentAccount({ id: 42, username: 'Alice' });
  calls = [];
  respond = async () => ({ status: 200, data: { user: { id: 42, username: 'Bob' } } });
  client.defaults.adapter = adapter;
  await router.replace('/account/profile');
});
afterEach(() => {
  client.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe('user center', () => {
  it('keeps shared page headers free of account controls and preserves page actions', async () => {
    const header = mount(PageHeader, {
      props: { title: '菜谱详情' },
      slots: { right: '<button>编辑</button>' },
    });
    expect(header.get('h1').text()).toBe('菜谱详情');
    expect(header.text()).toContain('编辑');
    expect(header.findComponent(AccountMenu).exists()).toBe(false);
    expect(header.find('[aria-label="账号菜单"]').exists()).toBe(false);
    await header.get('.header-back').trigger('click');
    expect(header.emitted('back')).toHaveLength(1);
    header.unmount();
  });

  it('provides account menu navigation and requires a session for direct access', async () => {
    await router.replace('/recipes');
    const menu = mount(AccountMenu, { global: { plugins: [router] } });
    await menu.get('a').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('user-center');
    menu.unmount();
    resetAccountSessionForTests();
    client.defaults.adapter = async (config) => {
      throw new AxiosError('unauthenticated', undefined, config, undefined, {
        status: 401,
        data: { error: { code: 'UNAUTHENTICATED', message: '请先登录' } },
        headers: {},
        config,
        statusText: '',
      });
    };
    await router.replace('/account');
    await router.push('/account/profile');
    expect(router.currentRoute.value.name).toBe('account');
    expect(router.currentRoute.value.query.redirect).toBe('/account/profile');
  });

  it('validates locally and preserves invalid inputs without requesting', async () => {
    const page = mountPage();
    await page.get('#profile-username').setValue('用户');
    await page.findAll('form')[0]!.trigger('submit');
    await page.get('#profile-new-password').setValue('short');
    await page.findAll('form')[1]!.trigger('submit');
    expect(page.findAll('[role="alert"]')).toHaveLength(2);
    expect(calls).toHaveLength(0);
    expect(document.querySelector('.memo-confirm-dialog')).toBeNull();
    page.unmount();
  });

  it('updates the current user and reports username success; back returns to recipes', async () => {
    const page = mountPage();
    expect(page.text()).toContain('当前用户名：Alice');
    await page.get('#profile-username').setValue('Bob');
    await page.findAll('form')[0]!.trigger('submit');
    await flushPromises();
    expect(calls).toEqual([{ method: 'patch', url: '/auth/username', body: { username: 'Bob' } }]);
    expect(currentAccount.value).toEqual({ id: 42, username: 'Bob' });
    expect(page.text()).toContain('用户名已更新');
    await page.get('.header-back').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('recipe-list');
    page.unmount();
  });

  it('preserves username and session on conflict and permits retry', async () => {
    respond = async () => ({
      status: 409,
      data: { error: { code: 'USERNAME_TAKEN', message: '账号名已被使用' } },
    });
    const page = mountPage();
    await page.get('#profile-username').setValue('Bob');
    await page.findAll('form')[0]!.trigger('submit');
    await flushPromises();
    expect(page.get('[role="alert"]').text()).toContain('账号名已被使用');
    expect((page.get('#profile-username').element as HTMLInputElement).value).toBe('Bob');
    expect(currentAccount.value?.username).toBe('Alice');
    expect(page.get('button[type="submit"]').attributes('disabled')).toBeUndefined();
    page.unmount();
  });

  it('prevents duplicate username updates and keeps input on network failure', async () => {
    let fail: (error: unknown) => void = () => {};
    respond = () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      });
    const page = mountPage();
    await page.get('#profile-username').setValue('Bob');
    await page.findAll('form')[0]!.trigger('submit');
    await page.findAll('form')[0]!.trigger('submit');
    expect(calls).toHaveLength(1);
    expect(page.get('#profile-username').attributes('disabled')).toBeDefined();
    fail(new AxiosError('Network Error'));
    await flushPromises();
    expect(page.get('[role="alert"]').text()).toContain('请检查网络');
    expect((page.get('#profile-username').element as HTMLInputElement).value).toBe('Bob');
    expect(currentAccount.value?.username).toBe('Alice');
    page.unmount();
  });

  async function fillPasswords(page: ReturnType<typeof mountPage>) {
    await page.get('#profile-current-password').setValue('current-pass');
    await page.get('#profile-new-password').setValue('new-password');
  }

  it('canceling confirmation writes nothing and keeps password inputs', async () => {
    const page = mountPage();
    await fillPasswords(page);
    await page.findAll('form')[1]!.trigger('submit');
    await flushPromises();
    expect(document.querySelectorAll('.memo-confirm-dialog')).toHaveLength(1);
    (document.querySelector('.van-dialog__cancel') as HTMLButtonElement).click();
    await flushPromises();
    expect(calls).toHaveLength(0);
    expect((page.get('#profile-new-password').element as HTMLInputElement).value).toBe(
      'new-password',
    );
    expect(page.find('[role="alert"]').exists()).toBe(false);
    page.unmount();
  });

  it('blocks duplicate submissions during confirmation and request, then clears passwords on success', async () => {
    let complete: (result: { status: number; data: unknown }) => void = () => {};
    respond = () =>
      new Promise((resolve) => {
        complete = resolve;
      });
    const page = mountPage();
    await fillPasswords(page);
    await page.findAll('form')[1]!.trigger('submit');
    await page.findAll('form')[1]!.trigger('submit');
    expect(document.querySelectorAll('.memo-confirm-dialog')).toHaveLength(1);
    expect(calls).toHaveLength(0);
    (document.querySelector('.van-dialog__confirm') as HTMLButtonElement).click();
    await flushPromises();
    await page.findAll('form')[1]!.trigger('submit');
    await page.findAll('form')[0]!.trigger('submit');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      method: 'put',
      url: '/auth/password',
      body: { currentPassword: 'current-pass', newPassword: 'new-password' },
    });
    complete({ status: 200, data: { user: { id: 42, username: 'Alice' } } });
    await flushPromises();
    expect((page.get('#profile-current-password').element as HTMLInputElement).value).toBe('');
    expect((page.get('#profile-new-password').element as HTMLInputElement).value).toBe('');
    expect(page.text()).toContain('密码已更新');
    expect(currentAccount.value?.id).toBe(42);
    page.unmount();
  });

  it('retains both passwords and shows a readable server error on failure', async () => {
    respond = async () => ({
      status: 400,
      data: { error: { code: 'CURRENT_PASSWORD_INCORRECT', message: '当前密码不正确' } },
    });
    const page = mountPage();
    await fillPasswords(page);
    await page.findAll('form')[1]!.trigger('submit');
    (document.querySelector('.van-dialog__confirm') as HTMLButtonElement).click();
    await flushPromises();
    expect(page.get('[role="alert"]').text()).toContain('当前密码不正确');
    expect((page.get('#profile-current-password').element as HTMLInputElement).value).toBe(
      'current-pass',
    );
    expect((page.get('#profile-new-password').element as HTMLInputElement).value).toBe(
      'new-password',
    );
    page.unmount();
  });
});
