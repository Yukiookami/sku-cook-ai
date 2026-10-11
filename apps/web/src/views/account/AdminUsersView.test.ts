import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminUsersView from './AdminUsersView.vue';
import AccountMenu from '../../components/common/AccountMenu.vue';
import { getAdminUsers } from '../../api/auth';
import { resetAccountSessionForTests, setCurrentAccount } from '../../auth/session';

vi.mock('../../api/auth', () => ({ getAdminUsers: vi.fn(), deleteAccountSession: vi.fn() }));

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/users', component: AdminUsersView },
      { path: '/recipes', component: { template: '<p>菜谱</p>' } },
    ],
  });
  await router.push('/admin/users');
  return mount(AdminUsersView, { global: { plugins: [router] } });
}

describe('read-only admin page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetAccountSessionForTests();
    setCurrentAccount({ id: 1, username: 'sku', isSuperAdmin: true, email: 'admin@example.com' });
  });

  it('does not fetch user data or show admin entry to ordinary accounts', async () => {
    setCurrentAccount({ id: 2, username: 'Alice', isSuperAdmin: false, email: null });
    const wrapper = await mountView();
    expect(wrapper.get('[role="alert"]').text()).toContain('仅超级管理员');
    expect(getAdminUsers).not.toHaveBeenCalled();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: AdminUsersView }],
    });
    const menu = mount(AccountMenu, { global: { plugins: [router] } });
    expect(menu.find('a[href="/admin/users"]').exists()).toBe(false);
    menu.unmount();
    wrapper.unmount();
  });

  it('shows email and registration time, prevents duplicate reads, and paginates', async () => {
    vi.mocked(getAdminUsers)
      .mockResolvedValueOnce({
        items: [{ id: 2, username: 'Alice', email: null, createdAt: '2026-10-11T00:00:00Z' }],
        page: 1,
        hasMore: true,
      })
      .mockResolvedValueOnce({ items: [], page: 2, hasMore: false });
    const wrapper = await mountView();
    await flushPromises();
    expect(wrapper.text()).toContain('Alice');
    expect(wrapper.text()).toContain('未设置');
    expect(wrapper.text()).toContain('注册时间');
    expect(wrapper.get('button.button-secondary').attributes('disabled')).toBeDefined();
    const next = wrapper.findAll('button').find((button) => button.text() === '下一页')!;
    await next.trigger('click');
    await next.trigger('click');
    await flushPromises();
    expect(getAdminUsers).toHaveBeenCalledTimes(2);
    expect(getAdminUsers).toHaveBeenLastCalledWith(2);
    expect(wrapper.text()).toContain('第 2 页');
    wrapper.unmount();
  });

  it('reports failures explicitly and allows retry', async () => {
    vi.mocked(getAdminUsers).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({
      items: [],
      page: 1,
      hasMore: false,
    });
    const wrapper = await mountView();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('无法读取用户列表');
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('暂无注册用户');
    wrapper.unmount();
  });
});
