import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TakeoutImportInputSchema, type TakeoutCandidate } from '@sku-cook/shared';
import TakeoutManagementView from './TakeoutManagementView.vue';
import {
  createTakeoutCandidate,
  deleteTakeoutCandidate,
  getTakeoutCandidates,
  importTakeoutCandidates,
  updateTakeoutCandidate,
} from '../../api/takeout';
import { copyTextToClipboard } from '../../utils/clipboard';

vi.mock('../../api/takeout', () => ({
  createTakeoutCandidate: vi.fn(),
  deleteTakeoutCandidate: vi.fn(),
  getTakeoutCandidates: vi.fn(),
  importTakeoutCandidates: vi.fn(),
  updateTakeoutCandidate: vi.fn(),
}));

vi.mock('../../utils/clipboard', () => ({
  copyTextToClipboard: vi.fn(),
}));

vi.mock('../../components/common/ConfirmDialog.vue', () => ({
  default: {
    props: ['options'],
    emits: ['close'],
    template:
      '<button v-if="options" type="button" @click="$emit(\'close\', true)">{{ options.confirmText }}</button>',
  },
}));

const candidate: TakeoutCandidate = {
  id: 31,
  name: '附近的面馆',
  url: 'https://food.example.com/share/31',
  createdAt: '2026-10-12T00:00:00.000Z',
  updatedAt: '2026-10-12T00:00:00.000Z',
};

async function selectJsonFile(wrapper: ReturnType<typeof mount>, contents: string) {
  const file = new File([contents], 'takeout.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(contents) });
  const input = wrapper.get('input[type="file"]').element as HTMLInputElement;
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await wrapper.get('input[type="file"]').trigger('change');
  await flushPromises();
}

describe('TakeoutManagementView', () => {
  const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

  function mountView() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/takeout', component: TakeoutManagementView }],
    });
    return router.push('/takeout').then(async () => {
      await router.isReady();
      return mount(TakeoutManagementView, { global: { plugins: [router] } });
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getTakeoutCandidates).mockResolvedValue([candidate]);
    vi.mocked(createTakeoutCandidate).mockResolvedValue(candidate);
    vi.mocked(updateTakeoutCandidate).mockResolvedValue(candidate);
    vi.mocked(deleteTakeoutCandidate).mockResolvedValue();
    vi.mocked(importTakeoutCandidates).mockResolvedValue({ importedCount: 2 });
    vi.mocked(copyTextToClipboard).mockResolvedValue();
  });

  afterEach(() => {
    if (originalCreateObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
    } else {
      Reflect.deleteProperty(URL, 'createObjectURL');
    }
    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
    } else {
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
    vi.restoreAllMocks();
  });

  it('exports every saved candidate in the import-compatible format without database fields', async () => {
    vi.mocked(getTakeoutCandidates).mockResolvedValue([
      candidate,
      {
        ...candidate,
        id: 32,
        name: '附近的面馆二店',
        url: 'https://food.example.com/share/32',
      },
    ]);
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:takeout-export');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const wrapper = await mountView();
    await flushPromises();

    await wrapper.get('.takeout-export-button').trigger('click');

    const exportedBlob = createObjectURL.mock.calls[0]?.[0];
    expect(exportedBlob).toBeInstanceOf(Blob);
    const exportedText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(exportedBlob!);
    });
    const exportedData = JSON.parse(exportedText);
    expect(TakeoutImportInputSchema.parse(exportedData)).toEqual({
      version: 1,
      candidates: [
        { name: candidate.name, url: candidate.url },
        { name: '附近的面馆二店', url: 'https://food.example.com/share/32' },
      ],
    });
    expect(click).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('已导出 2 项');
    wrapper.unmount();
  });

  it('does not produce an incomplete export beyond the import limit', async () => {
    vi.mocked(getTakeoutCandidates).mockResolvedValue(
      Array.from({ length: 1001 }, (_, index) => ({
        ...candidate,
        id: index + 1,
        name: `候选${index + 1}`,
        url: `https://food.example.com/share/${index + 1}`,
      })),
    );
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:takeout-export');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    const wrapper = await mountView();
    await flushPromises();

    await wrapper.get('.takeout-export-button').trigger('click');

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain('超过 JSON 单次导入上限 1000 项');
    wrapper.unmount();
  });

  it('copies the takeout JSON example through the shared clipboard helper', async () => {
    const wrapper = await mountView();
    await flushPromises();
    await wrapper.get('.takeout-copy-example').trigger('click');

    expect(copyTextToClipboard).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify(
        {
          version: 1,
          candidates: [{ name: '店铺名称', url: 'https://example.com/share' }],
        },
        null,
        2,
      ),
    );
    expect(wrapper.text()).toContain('JSON 格式示例已复制');
    wrapper.unmount();
  });

  it('loads safe external links and adds a validated candidate', async () => {
    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.get('.takeout-candidate-card').text()).toContain(candidate.name);
    const link = wrapper.get('.takeout-candidate-card a');
    expect(link.attributes('href')).toBe(candidate.url);
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');

    await wrapper.get('input[placeholder^="例如"]').setValue('  新店  ');
    await wrapper.get('input[type="url"]').setValue(' https://food.example.com/new ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(createTakeoutCandidate).toHaveBeenCalledExactlyOnceWith({
      name: '新店',
      url: 'https://food.example.com/new',
    });
    expect(wrapper.text()).toContain('已添加外卖候选');
    wrapper.unmount();
  });

  it('shows candidates without links without rendering an empty external anchor', async () => {
    vi.mocked(getTakeoutCandidates).mockResolvedValue([{ ...candidate, url: '' }]);
    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.get('.takeout-candidate-card').text()).toContain('未设置平台链接');
    expect(wrapper.find('.takeout-candidate-card a').exists()).toBe(false);
    wrapper.unmount();
  });

  it('rejects unsafe links locally and preserves entered values when saving fails', async () => {
    const wrapper = await mountView();
    await flushPromises();
    await wrapper.get('input[placeholder^="例如"]').setValue('测试店');
    await wrapper.get('input[type="url"]').setValue('javascript:alert(1)');
    await wrapper.get('form').trigger('submit');
    expect(createTakeoutCandidate).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('请输入有效的 HTTP 或 HTTPS 分享链接');

    await wrapper.get('input[type="url"]').setValue('https://food.example.com/new');
    vi.mocked(createTakeoutCandidate).mockRejectedValueOnce({
      isAxiosError: true,
      code: 'ERR_NETWORK',
    });
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('input[placeholder^="例如"]').element).toHaveProperty('value', '测试店');
    expect(wrapper.text()).toContain('保存结果暂未确认');
    expect(createTakeoutCandidate).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('requires a name inline but allows the platform link to be empty', async () => {
    const wrapper = await mountView();
    await flushPromises();
    const form = wrapper.get('.takeout-form');

    expect(form.attributes('novalidate')).toBeDefined();
    await form.trigger('submit');

    expect(wrapper.get('#candidate-name-error').text()).toBe('请填写店铺或菜品名称。');
    expect(wrapper.get('input[placeholder^="例如"]').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('input[type="url"]').attributes('aria-invalid')).toBe('false');
    expect(createTakeoutCandidate).not.toHaveBeenCalled();

    await wrapper.get('input[placeholder^="例如"]').setValue('电话点餐店');
    await form.trigger('submit');
    await flushPromises();
    expect(createTakeoutCandidate).toHaveBeenCalledExactlyOnceWith({ name: '电话点餐店', url: '' });
    wrapper.unmount();
  });

  it('edits an existing candidate without making its URL unique by name', async () => {
    const wrapper = await mountView();
    await flushPromises();
    await wrapper.get('.takeout-candidate-actions .button-secondary').trigger('click');
    await wrapper.get('input[placeholder^="例如"]').setValue('改过的名字');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(updateTakeoutCandidate).toHaveBeenCalledExactlyOnceWith(31, {
      name: '改过的名字',
      url: candidate.url,
    });
    expect(wrapper.text()).toContain('已保存修改');
    wrapper.unmount();
  });

  it('rejects duplicated links in a JSON batch before offering confirmation', async () => {
    const wrapper = await mountView();
    await flushPromises();
    await selectJsonFile(
      wrapper,
      JSON.stringify({
        version: 1,
        candidates: [
          { name: '店一', url: 'https://food.example.com/same' },
          { name: '店二', url: 'https://food.example.com/same' },
        ],
      }),
    );

    expect(wrapper.text()).toContain('JSON 中包含重复分享链接');
    expect(wrapper.text()).toContain('第2项分享链接');
    expect(wrapper.findAll('button').some((button) => button.text() === '确认导入')).toBe(false);
    expect(importTakeoutCandidates).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('allows multiple imported candidates to omit their links', async () => {
    const wrapper = await mountView();
    await flushPromises();
    const input = {
      version: 1,
      candidates: [{ name: '电话点餐店' }, { name: '没有分享页', url: '' }],
    };
    await selectJsonFile(wrapper, JSON.stringify(input));

    expect(wrapper.text()).toContain('将导入 2 项');
    const importButton = wrapper.findAll('button').find((button) => button.text() === '确认导入');
    expect(importButton).toBeDefined();
    await importButton!.trigger('click');
    await flushPromises();

    expect(importTakeoutCandidates).toHaveBeenCalledExactlyOnceWith({
      version: 1,
      candidates: [
        { name: '电话点餐店', url: '' },
        { name: '没有分享页', url: '' },
      ],
    });
    wrapper.unmount();
  });

  it('shows the validated batch size and submits the exact versioned envelope', async () => {
    const wrapper = await mountView();
    await flushPromises();
    const input = {
      version: 1,
      candidates: [
        { name: '店一', url: 'https://food.example.com/1' },
        { name: '店二', url: 'https://food.example.com/2' },
      ],
    } as const;
    await selectJsonFile(wrapper, JSON.stringify(input));
    expect(wrapper.text()).toContain('将导入 2 项');
    const importButton = wrapper.findAll('button').find((button) => button.text() === '确认导入');
    expect(importButton).toBeDefined();
    await importButton!.trigger('click');
    await flushPromises();

    expect(importTakeoutCandidates).toHaveBeenCalledExactlyOnceWith(input);
    expect(wrapper.text()).toContain('成功导入 2 项外卖候选');
    wrapper.unmount();
  });

  it('keeps the uncertain import available and enables retry only after a fresh list shows no new items', async () => {
    const wrapper = await mountView();
    await flushPromises();
    const input = {
      version: 1,
      candidates: [{ name: '电话点餐店', url: '' }],
    } as const;
    await selectJsonFile(wrapper, JSON.stringify(input));
    vi.mocked(importTakeoutCandidates)
      .mockRejectedValueOnce({ isAxiosError: true, code: 'ERR_NETWORK' })
      .mockResolvedValueOnce({ importedCount: 1 });
    vi.mocked(getTakeoutCandidates).mockResolvedValueOnce([candidate]);

    await wrapper
      .get('.takeout-import-card .takeout-form-actions button.button-primary')
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('导入结果暂未确认');
    expect(wrapper.text()).toContain('已保留本次 1 项导入内容');
    expect(wrapper.findAll('button').some((button) => button.text() === '确认导入')).toBe(false);
    expect(wrapper.findAll('button').some((button) => button.text() === '等待核对…')).toBe(true);

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '重新读取候选')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('未发现本次新增项');
    expect(wrapper.findAll('button').some((button) => button.text() === '再次确认导入')).toBe(true);

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '再次确认导入')!
      .trigger('click');
    await flushPromises();
    expect(importTakeoutCandidates).toHaveBeenCalledTimes(2);
    expect(importTakeoutCandidates).toHaveBeenLastCalledWith(input);
    expect(wrapper.text()).toContain('成功导入 1 项外卖候选');
    wrapper.unmount();
  });

  it('recognizes a committed import after the response was lost and does not resubmit it', async () => {
    const wrapper = await mountView();
    await flushPromises();
    const input = {
      version: 1,
      candidates: [{ name: '电话点餐店', url: '' }],
    } as const;
    await selectJsonFile(wrapper, JSON.stringify(input));
    vi.mocked(importTakeoutCandidates).mockRejectedValueOnce({
      isAxiosError: true,
      code: 'ERR_NETWORK',
    });
    vi.mocked(getTakeoutCandidates).mockResolvedValueOnce([
      candidate,
      {
        ...candidate,
        id: 32,
        name: '电话点餐店',
        url: '',
      },
    ]);

    await wrapper
      .get('.takeout-import-card .takeout-form-actions button.button-primary')
      .trigger('click');
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '重新读取候选')!
      .trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('已在列表中确认导入 1 项');
    expect(wrapper.findAll('button').some((button) => button.text() === '再次确认导入')).toBe(
      false,
    );
    expect(importTakeoutCandidates).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('accepts pasted GPT JSON, validates it locally, and imports only after confirmation', async () => {
    const wrapper = await mountView();
    await flushPromises();
    await wrapper.get('[aria-label="选择导入方式"] button:last-of-type').trigger('click');

    const input = {
      version: 1,
      candidates: [{ name: '附近的盖饭', url: 'https://food.example.com/share/rice' }],
    } as const;
    const textarea = wrapper.get('textarea');
    await textarea.setValue(JSON.stringify(input));

    expect(wrapper.text()).toContain('将导入 1 项');
    expect(importTakeoutCandidates).not.toHaveBeenCalled();
    await textarea.setValue('{invalid');
    expect(wrapper.text()).not.toContain('将导入 1 项');
    expect(wrapper.findAll('button').some((button) => button.text() === '确认导入')).toBe(false);

    await textarea.setValue(JSON.stringify(input));
    expect(wrapper.text()).toContain('将导入 1 项');
    vi.mocked(importTakeoutCandidates).mockResolvedValueOnce({ importedCount: 1 });
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '确认导入')!
      .trigger('click');
    await flushPromises();

    expect(importTakeoutCandidates).toHaveBeenCalledExactlyOnceWith(input);
    expect(wrapper.text()).toContain('成功导入 1 项外卖候选');
    wrapper.unmount();
  });

  it('rejects invalid pasted JSON and duplicate URLs without enabling import', async () => {
    const wrapper = await mountView();
    await flushPromises();
    await wrapper.get('[aria-label="选择导入方式"] button:last-of-type').trigger('click');

    const textarea = wrapper.get('textarea');
    await textarea.setValue('{invalid');
    expect(wrapper.text()).toContain('粘贴内容不是有效的 JSON');
    expect(wrapper.findAll('button').some((button) => button.text() === '确认导入')).toBe(false);

    await textarea.setValue(
      JSON.stringify({
        version: 1,
        candidates: [
          { name: '店一', url: 'https://food.example.com/same' },
          { name: '店二', url: 'https://food.example.com/same' },
        ],
      }),
    );
    expect(wrapper.text()).toContain('JSON 中包含重复分享链接');
    expect(wrapper.text()).toContain('第2项分享链接');
    expect(importTakeoutCandidates).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('confirms before deleting and only removes an item after the API succeeds', async () => {
    const wrapper = await mountView();
    await flushPromises();
    await wrapper.get('.takeout-candidate-actions .button-danger').trigger('click');
    expect(deleteTakeoutCandidate).not.toHaveBeenCalled();
    await wrapper.get('main > button').trigger('click');
    await flushPromises();

    expect(deleteTakeoutCandidate).toHaveBeenCalledExactlyOnceWith(candidate.id);
    expect(wrapper.find('.takeout-candidate-card').exists()).toBe(false);
    wrapper.unmount();
  });
});
