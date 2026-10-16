import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import KitchenMenuPanel from './KitchenMenuPanel.vue';
import ConfirmDialog from '../common/ConfirmDialog.vue';
import { clearKitchenMenu, getKitchenState, replaceKitchenMenu } from '../../api/kitchen';
import { KitchenStateResponseSchema, RecipeSummarySchema } from '@sku-cook/shared';

vi.mock('../../api/kitchen', () => ({
  getKitchenState: vi.fn(),
  replaceKitchenMenu: vi.fn(),
  clearKitchenMenu: vi.fn(),
}));

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

function sentKitchen(items: typeof currentKitchen.session.items, revision = 8) {
  return KitchenStateResponseSchema.parse({
    session: {
      recipeIds: items.map((item) => item.recipeId),
      items,
      activeRecipeId: items[0]?.recipeId ?? null,
      revision,
      updatedAt: '2026-10-08T05:00:00.000Z',
      recipes: items.map((item) =>
        item.recipeId === soup.id ? fullSoup : { ...fullSoup, ...recipe },
      ),
    },
    pollIntervalSeconds: 10,
  });
}

describe('KitchenMenuPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getKitchenState).mockResolvedValue(currentKitchen);
    vi.mocked(replaceKitchenMenu).mockImplementation(async (input) =>
      sentKitchen(input.items, input.expectedRevision + 1),
    );
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
    expect(wrapper.get('.send-success-dialog .panel-success').text()).toContain('已发送到厨房');
    expect(wrapper.get('.panel-success').text()).toContain('将在下次读取时更新');
    expect(wrapper.get('.panel-success').text()).toContain('登录同一账号');
    expect(wrapper.get('.panel-success').text()).toContain('已保存 2 道菜');
    expect(wrapper.findAll('.panel-actions button').map((button) => button.text())).toEqual([
      '完成',
      '返回菜谱一览',
    ]);
    expect(wrapper.emitted('close')).toBeUndefined();
    await wrapper.get('.panel-actions button').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
    expect(wrapper.emitted('return-to-recipes')).toBeUndefined();
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
    expect(wrapper.find('.panel-operation-status').exists()).toBe(false);
    expect(wrapper.text().match(/正在发送/g)).toHaveLength(1);
    const pendingButton = wrapper.get('.button-primary');
    expect(pendingButton.text()).toContain('正在发送…');
    expect(pendingButton.attributes('aria-busy')).toBe('true');
    expect(pendingButton.attributes('disabled')).toBeDefined();
    expect(wrapper.get('[aria-label="关闭"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.panel-success').exists()).toBe(false);

    await pendingButton.trigger('click');
    await wrapper.get('.panel-scrim').trigger('click');
    expect(wrapper.emitted('close')).toBeUndefined();
    expect(replaceKitchenMenu).toHaveBeenCalledTimes(1);

    resolveSend?.(sentKitchen([{ recipeId: 11, targetServings: 2 }]));
    await flushPromises();

    expect(wrapper.get('.send-success-dialog .panel-success').text()).toContain('已发送到厨房');
    expect(wrapper.emitted('sent')).toHaveLength(1);
    await wrapper.get('.panel-actions button:last-child').trigger('click');
    expect(wrapper.emitted('return-to-recipes')).toHaveLength(1);
    expect(wrapper.emitted('close')).toBeUndefined();
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

  it('does not turn an unknown send result into a version conflict or allow blind resending', async () => {
    vi.mocked(replaceKitchenMenu).mockRejectedValueOnce(
      Object.assign(new Error('network timeout'), { isAxiosError: true }),
    );
    const wrapper = mount(KitchenMenuPanel, {
      props: { show: false, mode: 'send', selections: [recipe] },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.setProps({ show: true });
    await flushPromises();
    await wrapper.get('.panel-actions .button-primary').trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('发送结果暂未确认');
    expect(wrapper.text()).not.toContain('厨房菜单已变更');
    expect(wrapper.get('.panel-actions .button-primary').attributes('disabled')).toBeDefined();
    expect(getKitchenState).toHaveBeenCalledTimes(1);
    expect(replaceKitchenMenu).toHaveBeenCalledOnce();
    expect(wrapper.find('.panel-success').exists()).toBe(false);
    await wrapper.get('.inline-error .text-button').trigger('click');
    await flushPromises();
    expect(getKitchenState).toHaveBeenCalledTimes(2);
    expect(replaceKitchenMenu).toHaveBeenCalledOnce();
    expect(wrapper.get('.panel-actions .button-primary').attributes('disabled')).toBeUndefined();
    wrapper.unmount();
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
    expect(wrapper.get('[role="status"]').text()).toContain('已读取最新菜单');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('.inline-error .text-button').exists()).toBe(false);
    expect(wrapper.text()).toContain('目标 3 人份');
    expect(wrapper.text()).toContain('冬瓜汤');
    expect(wrapper.find('.panel-success').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('已发送到厨房');
  });

  it('requires explicit confirmation to resend against the refreshed kitchen revision', async () => {
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
    vi.mocked(replaceKitchenMenu)
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce(sentKitchen([{ recipeId: 11, targetServings: 3 }], 9));

    const wrapper = mount(KitchenMenuPanel, {
      props: { show: false, mode: 'send', selections: [recipe] },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.setProps({ show: true });
    await flushPromises();
    await wrapper.get('[aria-label="番茄炒蛋增加一份"]').trigger('click');
    await wrapper.get('.panel-actions .button-primary').trigger('click');
    await flushPromises();

    expect(getKitchenState).toHaveBeenCalledTimes(2);
    expect(replaceKitchenMenu).toHaveBeenCalledExactlyOnceWith({
      items: [{ recipeId: 11, targetServings: 3 }],
      expectedRevision: 7,
    });
    expect(wrapper.get('.panel-actions .button-primary').text()).toContain('确认并发送到厨房');
    expect(wrapper.find('.panel-success').exists()).toBe(false);

    await wrapper.get('.panel-actions .button-primary').trigger('click');
    await flushPromises();

    expect(replaceKitchenMenu).toHaveBeenCalledTimes(2);
    expect(replaceKitchenMenu).toHaveBeenLastCalledWith({
      items: [{ recipeId: 11, targetServings: 3 }],
      expectedRevision: 8,
    });
    expect(wrapper.get('.panel-success').text()).toContain('已发送到厨房');
    wrapper.unmount();
  });

  it('keeps a refresh failure visible and requires a fresh read before confirming the resend', async () => {
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
    vi.mocked(getKitchenState)
      .mockResolvedValueOnce(currentKitchen)
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(updated);
    vi.mocked(replaceKitchenMenu)
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce(sentKitchen([{ recipeId: 11, targetServings: 2 }], 9));

    const wrapper = mount(KitchenMenuPanel, {
      props: { show: false, mode: 'send', selections: [recipe] },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.setProps({ show: true });
    await flushPromises();
    await wrapper.get('.panel-actions .button-primary').trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('无法读取厨房菜单');
    expect(wrapper.get('.panel-actions .button-primary').attributes('disabled')).toBeDefined();
    expect(replaceKitchenMenu).toHaveBeenCalledOnce();

    await wrapper.get('.inline-error .text-button').trigger('click');
    await flushPromises();
    expect(wrapper.get('.panel-actions .button-primary').text()).toContain('确认并发送到厨房');
    expect(wrapper.get('.panel-actions .button-primary').attributes('disabled')).toBeUndefined();

    await wrapper.get('.panel-actions .button-primary').trigger('click');
    await flushPromises();
    expect(replaceKitchenMenu).toHaveBeenLastCalledWith({
      items: [{ recipeId: 11, targetServings: 2 }],
      expectedRevision: 8,
    });
    expect(wrapper.get('.panel-success').text()).toContain('已发送到厨房');
    wrapper.unmount();
  });

  it('clears the kitchen with its observed revision only after confirmation', async () => {
    vi.mocked(getKitchenState).mockResolvedValueOnce(menuKitchen);
    vi.mocked(clearKitchenMenu).mockResolvedValueOnce(currentKitchen);
    const wrapper = mount(KitchenMenuPanel, {
      props: { show: false, mode: 'view', selections: [] },
      global: { stubs: { Teleport: true, ConfirmDialog: true } },
    });
    await wrapper.setProps({ show: true });
    await flushPromises();
    await wrapper.get('button.button-danger').trigger('click');
    expect(clearKitchenMenu).not.toHaveBeenCalled();
    wrapper.getComponent(ConfirmDialog).vm.$emit('close', true);
    await flushPromises();

    expect(clearKitchenMenu).toHaveBeenCalledWith({ expectedRevision: 7 });
    expect(wrapper.text()).toContain('厨房当前没有菜单');
    wrapper.unmount();
  });

  it('keeps the current kitchen menu when clearing is canceled', async () => {
    vi.mocked(getKitchenState).mockResolvedValueOnce(menuKitchen);
    const wrapper = mount(KitchenMenuPanel, {
      props: { show: false, mode: 'view', selections: [] },
      global: { stubs: { Teleport: true, ConfirmDialog: true } },
    });
    await wrapper.setProps({ show: true });
    await flushPromises();
    await wrapper.get('button.button-danger').trigger('click');
    expect(wrapper.getComponent(ConfirmDialog).props('options')?.title).toBe('清空厨房菜单');
    expect(wrapper.get('button[aria-label="关闭"]').attributes('disabled')).toBeDefined();
    wrapper.getComponent(ConfirmDialog).vm.$emit('close', false);
    await flushPromises();
    expect(clearKitchenMenu).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('冬瓜汤');
    expect(wrapper.get('button[aria-label="关闭"]').attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });
});
