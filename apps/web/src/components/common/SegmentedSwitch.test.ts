import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SegmentedSwitch from './SegmentedSwitch.vue';

const options = [
  { label: '自己做', value: 'cook' },
  { label: '点外卖', value: 'takeout' },
] as const;

describe('SegmentedSwitch', () => {
  it('renders the selected option accessibly and emits the other value', async () => {
    const wrapper = mount(SegmentedSwitch, {
      props: {
        modelValue: 'cook',
        options,
        label: '推荐方式',
      },
    });

    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('推荐方式');
    expect(wrapper.findAll('button').map((button) => button.attributes('aria-pressed'))).toEqual([
      'true',
      'false',
    ]);
    await wrapper.findAll('button')[1]!.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['takeout']]);
  });

  it('disables both options while an owning operation is busy', () => {
    const wrapper = mount(SegmentedSwitch, {
      props: {
        modelValue: 'cook',
        options,
        label: '推荐方式',
        disabled: true,
      },
    });

    expect(
      wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true);
  });
});
