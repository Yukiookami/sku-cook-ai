import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showToast } from 'vant';
import KitchenMenuPanel from './KitchenMenuPanel.vue';
import { clearKitchenMenu, getKitchenState, replaceKitchenMenu } from '../../api/kitchen';
import { KitchenStateResponseSchema, RecipeSummarySchema } from '@sku-cook/shared';

vi.mock('../../api/kitchen', () => ({
  getKitchenState: vi.fn(),
  replaceKitchenMenu: vi.fn(),
  clearKitchenMenu: vi.fn(),
}));

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vant')>();
  return { ...actual, showToast: vi.fn() };
});

const recipe = RecipeSummarySchema.parse({
  id: 11,
  title: '番茄炒蛋',
  description: null,
  servings: 2,
  prepMinutes: null,
  cookMinutes: null,
  difficulty: null,
  tags: [],
  updatedAt: '2026-10-08T05:00:00.000Z',
});
const soup = RecipeSummarySchema.parse({ ...recipe, id: 12, title: '冬瓜汤', servings: 1 });
const fullSoup = {
  ...soup,
  ingredients: [
    {
      name: '冬瓜',
      amount: '2',
      unit: '块',
      note: null,
      group: null,
      scaleWithServings: true,
    },
  ],
  steps: [{ order: 1, text: '冬瓜切块后煮熟。' }],
  tips: null,
  source: null,
  createdAt: '2026-10-08T05:00:00.000Z',
};

const currentKitchen = KitchenStateResponseSchema.parse({
  session: {
    recipeIds: [],
    items: [],
    activeRecipeId: null,
    revision: 7,
    updatedAt: null,
    recipes: [],
  },
  pollIntervalSeconds: 10,
});

const menuKitchen = KitchenStateResponseSchema.parse({
  session: {
    recipeIds: [12],
    items: [{ recipeId: 12, targetServings: 2 }],
    activeRecipeId: 12,
    revision: 7,
    updatedAt: '2026-10-08T05:00:00.000Z',
    recipes: [fullSoup],
  },
  pollIntervalSeconds: 10,
});

describe('KitchenMenuPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getKitchenState).mockResolvedValue(currentKitchen);
    vi.mocked(replaceKitchenMenu).mockResolvedValue({
      ...currentKitchen,
      session: { ...currentKitchen.session, revision: 8 },
    });
    vi.mocked(clearKitchenMenu).mockResolvedValue(currentKitchen);
  });

  it('reads only when opened and sends the independently adjusted target with the observed revision', async () => {
    const wrapper = mount(KitchenMenuPanel, {
      props: {
        show: false,
        mode: 'send',
        selections: [recipe, soup],
      },
      global: { stubs: { Teleport: true } },
    });
    expect(getKitchenState).not.toHaveBeenCalled();

    await wrapper.setProps({ show: true });
    await flushPromises();
    expect(getKitchenState).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('原 2 人份');

    await wrapper.get('[aria-label="番茄炒蛋增加一份"]').trigger('click');
    expect(wrapper.text()).toContain('目标 3 人份');
    await wrapper.get('button.button-primary').trigger('click');
    await flushPromises();

    expect(replaceKitchenMenu).toHaveBeenCalledWith({
      items: [
        { recipeId: 11, targetServings: 3 },
        { recipeId: 12, targetServings: 1 },
      ],
      expectedRevision: 7,
    });
    expect(wrapper.emitted('sent')).toHaveLength(1);
    expect(showToast).toHaveBeenCalledWith({
      message: '已发送，厨房屏将在几秒内更新',
      type: 'success',
    });
  });

  it('shows a pending state, blocks closing and duplicate sends, then confirms success', async () => {
    let resolveSend: ((value: typeof currentKitchen) => void) | undefined;
    const sendPromise = new Promise<typeof currentKitchen>((resolve) => {
      resolveSend = resolve;
    });
    vi.mocked(replaceKitchenMenu).mockReturnValue(sendPromise);

    const wrapper = mount(KitchenMenuPanel, {
      props: { show: false, mode: 'send', selections: [recipe] },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.setProps({ show: true });
    await flushPromises();

    const sendButton = wrapper.get('.button-primary');
    expect(getKitchenState).toHaveBeenCalledTimes(1);
    expect(sendButton.attributes('disabled')).toBeUndefined();
    await sendButton.trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain('正在发送菜单，请稍候');
    const pendingButton = wrapper.get('.button-primary');
    expect(pendingButton.text()).toContain('正在发送…');
    expect(pendingButton.attributes('aria-busy')).toBe('true');
    expect(pendingButton.attributes('disabled')).toBeDefined();
    expect(wrapper.get('[aria-label="关闭"]').attributes('disabled')).toBeDefined();

    await pendingButton.trigger('click');
    await wrapper.get('.panel-scrim').trigger('click');
    expect(wrapper.emitted('close')).toBeUndefined();
    expect(replaceKitchenMenu).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalled();

    resolveSend?.({
      ...currentKitchen,
      session: { ...currentKitchen.session, revision: 8 },
    });
    await flushPromises();

    expect(showToast).toHaveBeenCalledWith({
      message: '已发送，厨房屏将在几秒内更新',
      type: 'success',
    });
    expect(wrapper.emitted('sent')).toHaveLength(1);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('retains the recipe serving target and does not read while closed', async () => {
    const wrapper = mount(KitchenMenuPanel, {
      props: {
        show: false,
        mode: 'send',
        selections: [recipe],
      },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.setProps({ show: true });
    await flushPromises();
    await wrapper.get('[aria-label="番茄炒蛋减少一份"]').trigger('click');
    expect(wrapper.get('[aria-label="番茄炒蛋减少一份"]').attributes('disabled')).toBeDefined();

    await wrapper.setProps({ show: false });
    await flushPromises();
    expect(getKitchenState).toHaveBeenCalledTimes(1);
  });

  it('reloads a conflicting kitchen revision without automatically resending', async () => {
    const updated = KitchenStateResponseSchema.parse({
      session: {
        ...currentKitchen.session,
        recipeIds: [12],
        items: [{ recipeId: 12, targetServings: 1 }],
        activeRecipeId: 12,
        revision: 8,
        recipes: [fullSoup],
      },
      pollIntervalSeconds: 10,
    });
    const conflict = Object.assign(new Error('revision conflict'), {
      isAxiosError: true,
      response: { status: 409 },
    });
    vi.mocked(getKitchenState).mockResolvedValueOnce(currentKitchen).mockResolvedValueOnce(updated);
    vi.mocked(replaceKitchenMenu).mockRejectedValueOnce(conflict);

    const wrapper = mount(KitchenMenuPanel, {
      props: { show: false, mode: 'send', selections: [recipe] },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.setProps({ show: true });
    await flushPromises();
    await wrapper.get('[aria-label="番茄炒蛋增加一份"]').trigger('click');
    await wrapper.get('button.button-primary').trigger('click');
    await flushPromises();

    expect(getKitchenState).toHaveBeenCalledTimes(2);
    expect(replaceKitchenMenu).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('厨房菜单已变更，请重新读取后确认');
    expect(wrapper.text()).toContain('目标 3 人份');
    expect(wrapper.text()).toContain('冬瓜汤');
  });

  it('clears the kitchen with its observed revision only after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(getKitchenState).mockResolvedValueOnce(menuKitchen);
    vi.mocked(clearKitchenMenu).mockResolvedValueOnce(currentKitchen);
    const wrapper = mount(KitchenMenuPanel, {
      props: { show: false, mode: 'view', selections: [] },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.setProps({ show: true });
    await flushPromises();
    await wrapper.get('button.button-danger').trigger('click');
    await flushPromises();

    expect(confirm).toHaveBeenCalledOnce();
    expect(clearKitchenMenu).toHaveBeenCalledWith({ expectedRevision: 7 });
    expect(wrapper.text()).toContain('厨房当前没有菜单');
    confirm.mockRestore();
    wrapper.unmount();
  });
});
