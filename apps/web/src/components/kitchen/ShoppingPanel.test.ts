import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Calendar } from 'vant';
import {
  CookShoppingBatchInputSchema,
  ShoppingBatchSchema,
  ShoppingPreviewSchema,
  type ShoppingBatch,
} from '@sku-cook/shared';
import ShoppingPanel from './ShoppingPanel.vue';
import ConfirmDialog from '../common/ConfirmDialog.vue';
import {
  listShoppingBatches,
  previewShopping,
  saveShoppingBatch,
  sendShoppingBatch,
} from '../../api/shopping';

vi.mock('../../api/shopping', () => ({
  listShoppingBatches: vi.fn(),
  previewShopping: vi.fn(),
  saveShoppingBatch: vi.fn(),
  sendShoppingBatch: vi.fn(),
}));
const preview = ShoppingPreviewSchema.parse({
  recipes: [{ recipeId: '11', title: '番茄炒蛋', servings: '3人份' }],
  items: [
    {
      itemId: '1923904c-150b-4da9-86be-012cd2ec7844',
      name: '鸡蛋',
      quantityText: '3',
      unit: '个',
      sources: [{ recipeId: '11', originalText: '鸡蛋2个；原2人份，目标3人份' }],
    },
    {
      itemId: '1223904c-150b-4da9-86be-012cd2ec7844',
      name: '盐',
      quantityText: '适量',
      unit: '',
      sources: [{ recipeId: '11', originalText: '盐适量' }],
    },
  ],
});
function record(payload: ShoppingBatch['payload'], status: ShoppingBatch['status'] = 'pending') {
  return ShoppingBatchSchema.parse({
    payload,
    status,
    errorCode: null,
    message: null,
    receipt:
      status === 'succeeded'
        ? {
            shoppingId: payload.batchId,
            taskId: 'ff23904c-150b-4da9-86be-012cd2ec7844',
            replayed: true,
            url: `https://todo.example.test/shopping/${payload.batchId}`,
          }
        : null,
    createdAt: '2026-10-17T00:00:00.000Z',
  });
}
const wrappers: ReturnType<typeof mount>[] = [];
async function open() {
  const wrapper = mount(ShoppingPanel, {
    props: { show: false, selections: [{ recipeId: 11, targetServings: 3 }] },
    global: { stubs: { Teleport: true, ConfirmDialog: true } },
  });
  wrappers.push(wrapper);
  await wrapper.setProps({ show: true });
  await flushPromises();
  return wrapper;
}
describe('采购确认、恢复与原批次重试', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    vi.mocked(previewShopping).mockImplementation(async () => structuredClone(preview));
    vi.mocked(listShoppingBatches).mockResolvedValue([]);
    vi.mocked(saveShoppingBatch).mockImplementation(async (payload) => record(payload));
    vi.mocked(sendShoppingBatch).mockImplementation(async () => {
      const payload = vi.mocked(saveShoppingBatch).mock.calls.at(-1)?.[0];
      if (!payload) throw new Error('missing saved payload');
      return record(payload, 'succeeded');
    });
  });
  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount();
    sessionStorage.clear();
  });
  it('初次即显示时读取预览，Escape关闭弹层', async () => {
    const wrapper = mount(ShoppingPanel, {
      props: { show: true, selections: [{ recipeId: 11, targetServings: 3 }] },
      global: { stubs: { Teleport: true, ConfirmDialog: true } },
    });
    wrappers.push(wrapper);
    await flushPromises();
    expect(previewShopping).toHaveBeenCalledOnce();
    await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
  it('预览目标份数与来源，可排除已有项、改数量和日期，先保存后发送并展示链接', async () => {
    const wrapper = await open();
    expect(previewShopping).toHaveBeenCalledWith({ items: [{ recipeId: 11, targetServings: 3 }] });
    expect(wrapper.text()).toContain('番茄炒蛋 · 3人份');
    expect(wrapper.text()).toContain('原2人份，目标3人份');
    expect(wrapper.find('input[type="date"]').exists()).toBe(false);
    await wrapper.get('[aria-label="采购盐"]').setValue(false);
    await wrapper.get('[aria-label="鸡蛋采购数量"]').setValue('4');
    await wrapper.get('#shopping-date').trigger('click');
    expect(wrapper.getComponent(Calendar).props('switchMode')).toBe('year-month');
    wrapper.getComponent(Calendar).vm.$emit('select', new Date(2026, 9, 18));
    await wrapper.get('.shopping-date-actions .button-primary').trigger('click');
    expect(wrapper.get('#shopping-date').text()).toContain('2026-10-18');
    wrapper.get('.panel-scroll').element.scrollTop = 500;
    await wrapper.get('.panel-actions .button-primary').trigger('click');
    await flushPromises();
    const payload = vi.mocked(saveShoppingBatch).mock.calls[0]?.[0];
    expect(payload?.items).toHaveLength(1);
    expect(payload?.items[0]?.quantityText).toBe('4');
    expect(payload?.plannedDate).toBe('2026-10-18');
    expect(sendShoppingBatch).toHaveBeenCalledWith(payload?.batchId);
    expect(wrapper.text()).toContain('采购清单已发送');
    expect(wrapper.text()).not.toContain('原批次已锁定');
    expect(wrapper.text()).not.toContain('仅明确数值的同名同单位项合并');
    expect(wrapper.get('.panel-scroll').element.scrollTop).toBe(0);
    expect(wrapper.find('a[href*="todo.example.test"]').exists()).toBe(false);
  });
  it('日期选择取消不改动值，清除按钮可将日期恢复为空', async () => {
    const wrapper = await open();
    await wrapper.get('#shopping-date').trigger('click');
    wrapper.getComponent(Calendar).vm.$emit('select', new Date(2026, 10, 3));
    await wrapper.get('.shopping-date-actions .button-primary').trigger('click');
    await wrapper.get('#shopping-date').trigger('click');
    wrapper.getComponent(Calendar).vm.$emit('select', new Date(2026, 10, 4));
    await wrapper.get('.shopping-date-actions .button-secondary').trigger('click');
    expect(wrapper.get('#shopping-date').text()).toContain('2026-11-03');

    await wrapper.get('[aria-label="清除采购日期"]').trigger('click');
    expect(wrapper.get('#shopping-date').text()).toContain('选择日期');
  });
  it('Escape只关闭日期对话框，不关闭采购弹层', async () => {
    const wrapper = await open();
    await wrapper.get('#shopping-date').trigger('click');
    await wrapper.get('.shopping-date-dialog').trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('.shopping-date-dialog').exists()).toBe(false);
    expect(wrapper.find('.shopping-panel').exists()).toBe(true);
    expect(wrapper.emitted('close')).toBeUndefined();
  });
  it('全部排除时禁用发送，不生成空采购', async () => {
    const wrapper = await open();
    await wrapper.get('[aria-label="采购盐"]').setValue(false);
    await wrapper.get('[aria-label="采购鸡蛋"]').setValue(false);
    expect(wrapper.get('.panel-actions .button-primary').attributes('disabled')).toBeDefined();
    expect(saveShoppingBatch).not.toHaveBeenCalled();
  });
  it('重开时新预览读取失败，不允许发送上次未确认的旧预览', async () => {
    const wrapper = await open();
    await wrapper.setProps({ show: false });
    vi.mocked(previewShopping).mockRejectedValueOnce(new Error('offline'));
    await wrapper.setProps({ selections: [{ recipeId: 12, targetServings: 5 }], show: true });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('无法读取采购预览');
    expect(wrapper.get('.panel-actions .button-primary').attributes('disabled')).toBeDefined();
    expect(saveShoppingBatch).not.toHaveBeenCalled();
  });
  it('重复点击不重复发送，超时后冻结快照，重开恢复同一批次不重新抓菜单', async () => {
    let reject: ((cause: Error) => void) | undefined;
    vi.mocked(sendShoppingBatch).mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    const wrapper = await open();
    await wrapper.get('.panel-actions .button-primary').trigger('click');
    await flushPromises();
    expect(wrapper.get('.panel-actions .button-primary').text()).toBe('正在发送…');
    expect(wrapper.get('[aria-label="关闭采购预览"]').attributes('disabled')).toBeDefined();
    await wrapper.get('.panel-actions .button-primary').trigger('click');
    expect(sendShoppingBatch).toHaveBeenCalledTimes(1);
    reject?.(new Error('response lost'));
    await flushPromises();
    const original = CookShoppingBatchInputSchema.parse(
      vi.mocked(saveShoppingBatch).mock.calls[0]?.[0],
    );
    expect(wrapper.text()).toContain('发送结果暂未确认');
    wrapper.unmount();
    const resumed = await open();
    expect(previewShopping).toHaveBeenCalledTimes(1);
    expect(resumed.get('.panel-actions .button-primary').text()).toBe('重试原采购批次');
    await resumed.get('.panel-actions .button-primary').trigger('click');
    await flushPromises();
    expect(vi.mocked(saveShoppingBatch).mock.calls[1]?.[0]).toEqual(original);
    expect(sendShoppingBatch).toHaveBeenLastCalledWith(original?.batchId);
    expect(resumed.text()).toContain('采购清单已发送');
  });
  it('Todo 幂等冲突不能自动换 ID 重发，明确新采购需要二次确认', async () => {
    vi.mocked(sendShoppingBatch).mockImplementationOnce(async () => ({
      ...record(vi.mocked(saveShoppingBatch).mock.calls[0]![0], 'conflict'),
      message: '同一批次 ID 已用于不同内容',
      errorCode: 'IDEMPOTENCY_CONFLICT',
    }));
    const wrapper = await open();
    await wrapper.get('.panel-actions .button-primary').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('同一批次 ID 已用于不同内容');
    expect(wrapper.get('.panel-actions .button-primary').attributes('disabled')).toBeDefined();
    expect(saveShoppingBatch).toHaveBeenCalledTimes(1);
    await wrapper.get('.panel-actions .text-button').trigger('click');
    expect(wrapper.getComponent(ConfirmDialog).props('options')?.title).toBe('开始一份新采购');
    expect(wrapper.get('[aria-label="关闭采购预览"]').attributes('disabled')).toBeDefined();
    wrapper.getComponent(ConfirmDialog).vm.$emit('close', false);
    await flushPromises();
    expect(saveShoppingBatch).toHaveBeenCalledTimes(1);
    expect(wrapper.get('.panel-actions .button-primary').text()).toBe('重试原采购批次');
    await wrapper.get('.panel-actions .text-button').trigger('click');
    wrapper.getComponent(ConfirmDialog).vm.$emit('close', true);
    await flushPromises();
    expect(wrapper.find('.panel-actions .text-button').exists()).toBe(false);
    await wrapper.get('.panel-actions .button-primary').trigger('click');
    await flushPromises();
    expect(vi.mocked(saveShoppingBatch).mock.calls[1]?.[0].batchId).not.toBe(
      vi.mocked(saveShoppingBatch).mock.calls[0]?.[0].batchId,
    );
  });
  it('未启用或非绑定账号不伪造预览或成功', async () => {
    vi.mocked(listShoppingBatches).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403, data: { error: { code: 'SHOPPING_FORBIDDEN' } } },
    });
    const wrapper = await open();
    expect(wrapper.get('[role="alert"]').text()).toContain('当前账号没有采购发送权限');
    expect(previewShopping).not.toHaveBeenCalled();
    expect(wrapper.get('.panel-actions .button-primary').attributes('disabled')).toBeDefined();
  });
});
