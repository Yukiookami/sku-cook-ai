import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeForm from './RecipeForm.vue';
import { getRecipeTags } from '../../api/recipes';

vi.mock('../../api/recipes', () => ({
  getRecipeTags: vi.fn(),
}));

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

function mountForm() {
  return mount(RecipeForm, {
    props: { submitLabel: '保存菜谱' },
  });
}

describe('RecipeForm validation and quantity suggestions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getRecipeTags).mockResolvedValue({ tags: [] });
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('suggests combined amounts and units while preserving free-form unit input', async () => {
    const wrapper = mountForm();
    await flushPromises();

    expect(wrapper.text()).not.toContain('（可选）');
    const amountInput = wrapper.get<HTMLInputElement>('#ingredient-amount-0');
    expect(wrapper.find('.amount-field .autocomplete-suggestions').exists()).toBe(false);
    expect(wrapper.find('#ingredient-unit-0').exists()).toBe(false);
    await amountInput.trigger('focus');
    await amountInput.setValue('3');
    const suggestions = wrapper
      .findAll('.amount-field .autocomplete-option')
      .map((option) => option.text());
    expect(suggestions).toEqual(expect.arrayContaining(['3个', '3克', '3勺']));

    await wrapper.get('[role="option"][aria-label="选择 3克"]').trigger('click');
    expect(amountInput.element.value).toBe('3克');
    expect(wrapper.find('.amount-field .autocomplete-suggestions').exists()).toBe(false);

    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('#title').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('#ingredient-0').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('#step-0').attributes('aria-invalid')).toBe('true');

    await wrapper.get('#title').setValue('番茄炒蛋');
    await wrapper.get('#ingredient-0').setValue('鸡蛋');
    await wrapper.get('#step-0').setValue('鸡蛋打散后炒熟。');
    await flushPromises();
    expect(wrapper.findAll('.field-error')).toHaveLength(0);

    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      title: '番茄炒蛋',
      ingredients: [{ name: '鸡蛋', amount: '3', unit: '克' }],
    });
    wrapper.unmount();
  });

  it('hides the delete action when only one ingredient remains', async () => {
    const wrapper = mountForm();
    await flushPromises();

    expect(wrapper.findAll('.ingredient-editor .button-danger')).toHaveLength(0);
    await wrapper.get('.form-section:nth-of-type(2) > button.button-secondary').trigger('click');
    expect(wrapper.findAll('.ingredient-editor')).toHaveLength(2);
    expect(wrapper.findAll('.ingredient-editor .button-danger')).toHaveLength(2);

    await wrapper.get('.ingredient-editor .button-danger').trigger('click');
    expect(wrapper.findAll('.ingredient-editor')).toHaveLength(1);
    expect(wrapper.findAll('.ingredient-editor .button-danger')).toHaveLength(0);
    wrapper.unmount();
  });

  it('splits manually typed custom units into the shared ingredient fields', async () => {
    const wrapper = mountForm();
    await flushPromises();

    await wrapper.get('#title').setValue('番茄炒蛋');
    await wrapper.get('#ingredient-0').setValue('鸡蛋');
    await wrapper.get('#ingredient-amount-0').setValue('3枚');
    await wrapper.get('#step-0').setValue('鸡蛋打散后炒熟。');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      ingredients: [{ name: '鸡蛋', amount: '3', unit: '枚' }],
    });
    wrapper.unmount();
  });

  it('validates configured text and numeric limits and clears errors after correction', async () => {
    const wrapper = mountForm();
    await flushPromises();

    await wrapper.get('#title').setValue('菜'.repeat(51));
    await wrapper.get('#servings').setValue('101');
    await wrapper.get('#ingredient-0').setValue('鸡蛋');
    await wrapper.get('#ingredient-amount-0').setValue(`2${'单位'.repeat(11)}`);
    await wrapper.get('#step-0').setValue('炒熟。');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('#title').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('#servings').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('#ingredient-amount-0').attributes('aria-invalid')).toBe('true');

    await wrapper.get('#title').setValue('番茄炒蛋');
    await wrapper.get('#servings').setValue('2');
    await wrapper.get('#ingredient-amount-0').setValue('3个');
    await flushPromises();

    expect(wrapper.findAll('.field-error')).toHaveLength(0);
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('submit')).toHaveLength(1);
    wrapper.unmount();
  });

  it('keeps range quantities intact in the combined input', async () => {
    const wrapper = mountForm();
    await flushPromises();

    await wrapper.get('#title').setValue('番茄炒蛋');
    await wrapper.get('#ingredient-0').setValue('鸡蛋');
    await wrapper.get('#ingredient-amount-0').setValue('2～3');
    await wrapper.get('#step-0').setValue('鸡蛋打散后炒熟。');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      ingredients: [{ name: '鸡蛋', amount: '2～3' }],
    });
    wrapper.unmount();
  });

  it('supports keyboard selection from the autocomplete list', async () => {
    const wrapper = mountForm();
    await flushPromises();
    const amountInput = wrapper.get<HTMLInputElement>('#ingredient-amount-0');

    await amountInput.trigger('focus');
    await amountInput.setValue('2');
    await amountInput.trigger('keydown', { key: 'ArrowDown' });
    await amountInput.trigger('keydown', { key: 'Enter' });

    expect(amountInput.element.value).toBe('2个');
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('offers common amount shortcuts and submits their quantity text', async () => {
    const wrapper = mountForm();
    await flushPromises();

    const shortcuts = wrapper.findAll('.amount-shortcut').map((button) => button.text());
    expect(shortcuts).toEqual(['适量', '少量', '大量', '少许']);

    await wrapper.get('.amount-shortcut').trigger('click');
    expect(wrapper.get<HTMLInputElement>('#ingredient-amount-0').element.value).toBe('适量');
    await wrapper.get('#title').setValue('番茄炒蛋');
    await wrapper.get('#ingredient-0').setValue('盐');
    await wrapper.get('#step-0').setValue('加入少许盐调味。');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      ingredients: [{ name: '盐', amount: '适量' }],
    });
    wrapper.unmount();
  });

  it('opens searchable existing tags and keeps free-form tag entry available', async () => {
    vi.mocked(getRecipeTags).mockResolvedValue({ tags: ['汤', '快手菜', '凉拌菜'] });
    const wrapper = mountForm();
    await flushPromises();

    const tagInput = wrapper.get<HTMLInputElement>('#tagInput');
    await tagInput.trigger('focus');
    expect(
      wrapper.findAll('.tag-autocomplete .autocomplete-option').map((button) => button.text()),
    ).toEqual(['汤', '快手菜', '凉拌菜']);

    await tagInput.setValue('快');
    expect(
      wrapper.findAll('.tag-autocomplete .autocomplete-option').map((button) => button.text()),
    ).toEqual(['快手菜']);
    await wrapper.get('.tag-autocomplete .autocomplete-option').trigger('click');
    expect(wrapper.get('.removable-tag').text()).toContain('快手菜');
    expect(tagInput.element.value).toBe('快');

    await tagInput.setValue('自定义');
    await wrapper.get('.tag-input-row .button-primary').trigger('click');
    expect(wrapper.findAll('.removable-tag').map((tag) => tag.text())).toContain('自定义 ×');
    wrapper.unmount();
  });

  it('keeps ingredient drafts separate after deletion and submits reordered steps', async () => {
    const wrapper = mountForm();
    await flushPromises();
    await wrapper.get('#title').setValue('家常菜');
    await wrapper.get('#ingredient-0').setValue('盐');
    await wrapper.get('.form-section:nth-of-type(2) > button.button-secondary').trigger('click');
    await wrapper.get('#ingredient-1').setValue('鸡蛋');
    await wrapper.get('#ingredient-amount-1').setValue('2个');
    await wrapper.get('.ingredient-editor .button-danger').trigger('click');
    expect(wrapper.get<HTMLInputElement>('#ingredient-0').element.value).toBe('鸡蛋');
    expect(wrapper.get<HTMLInputElement>('#ingredient-amount-0').element.value).toBe('2个');

    await wrapper.get('#step-0').setValue('炒熟。');
    await wrapper.get('.form-section:nth-of-type(3) > button.button-secondary').trigger('click');
    await wrapper.get('#step-1').setValue('打散鸡蛋。');
    await wrapper
      .findAll('.step-editor')[1]
      ?.get('.step-actions .button-secondary')
      .trigger('click');
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      ingredients: [{ name: '鸡蛋', amount: '2', unit: '个' }],
      steps: [
        { order: 1, text: '打散鸡蛋。' },
        { order: 2, text: '炒熟。' },
      ],
    });
    await wrapper.setProps({ saving: true, serverError: '保存失败，草稿已保留。' });
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get<HTMLInputElement>('#ingredient-0').element.value).toBe('鸡蛋');
    expect(wrapper.text()).toContain('保存失败，草稿已保留。');
    wrapper.unmount();
  });
});
