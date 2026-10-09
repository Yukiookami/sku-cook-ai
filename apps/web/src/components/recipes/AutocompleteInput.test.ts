import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import AutocompleteInput from './AutocompleteInput.vue';

function mountInput() {
  return mount(AutocompleteInput, {
    props: { id: 'quantity', modelValue: '2', suggestions: ['2个', '2克'], label: '用量' },
  });
}

describe('AutocompleteInput', () => {
  it('emits edits and selections without changing the supplied value', async () => {
    const wrapper = mountInput();
    await wrapper.get('input').setValue('3');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['3']);
    await wrapper.get('input').trigger('focus');
    await wrapper.get('[role="option"]').trigger('click');
    expect(wrapper.emitted('select')?.[0]).toEqual(['2个']);
    expect(wrapper.props('modelValue')).toBe('2');
    expect(wrapper.get('input').attributes('aria-expanded')).toBe('false');
    wrapper.unmount();
  });

  it('closes with Escape and ignores Enter during IME composition', async () => {
    const wrapper = mountInput();
    await wrapper.get('input').trigger('focus');
    await wrapper.get('input').trigger('keydown', { key: 'Enter', isComposing: true });
    expect(wrapper.emitted('select')).toBeUndefined();
    await wrapper.get('input').trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('uses the explicitly supplied boundary and scrolls the active keyboard option', async () => {
    const wrapper = mountInput();
    const boundary = document.createElement('div');
    vi.spyOn(boundary, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 420, 390, 80));
    vi.spyOn(wrapper.get('input').element, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(20, 350, 300, 48),
    );
    await wrapper.setProps({ popupBoundary: boundary });
    await wrapper.get('input').trigger('focus');
    expect(wrapper.get('[role="listbox"]').classes()).toContain('above');
    const option = wrapper.get('[role="option"]').element;
    const scroll = vi.fn();
    Object.defineProperty(option, 'scrollIntoView', { value: scroll });
    await wrapper.get('input').trigger('keydown', { key: 'ArrowDown' });
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
    await wrapper.get('input').trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('select')?.[0]).toEqual(['2个']);
    wrapper.unmount();
  });
});
