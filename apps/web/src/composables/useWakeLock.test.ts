import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref, toRef } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from './useWakeLock';

type Sentinel = {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

const originalSecureContext = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
const originalWakeLock = Object.getOwnPropertyDescriptor(navigator, 'wakeLock');

const Harness = defineComponent({
  props: { hasMenu: { type: Boolean, required: true } },
  setup(props) {
    const unavailable = ref(false);
    useWakeLock(toRef(props, 'hasMenu'), unavailable);
    return () => h('p', unavailable.value ? 'unavailable' : 'active');
  },
});

function enableWakeLock(pending: Promise<Sentinel>) {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request: vi.fn(() => pending) },
  });
}

afterEach(() => {
  if (originalSecureContext) {
    Object.defineProperty(window, 'isSecureContext', originalSecureContext);
  } else {
    Reflect.deleteProperty(window, 'isSecureContext');
  }
  if (originalWakeLock) {
    Object.defineProperty(navigator, 'wakeLock', originalWakeLock);
  } else {
    Reflect.deleteProperty(navigator, 'wakeLock');
  }
});

describe('useWakeLock pending request lifecycle', () => {
  it('releases a late sentinel after the kitchen menu becomes empty', async () => {
    let resolveRequest: (value: Sentinel) => void = () => {
      throw new Error('Wake Lock request has not started');
    };
    const pending = new Promise<Sentinel>((resolve) => {
      resolveRequest = resolve;
    });
    enableWakeLock(pending);
    const wrapper = mount(Harness, { props: { hasMenu: true } });
    await flushPromises();

    await wrapper.setProps({ hasMenu: false });
    const sentinel = {
      release: vi.fn(async () => undefined),
      addEventListener: vi.fn(),
    };
    resolveRequest(sentinel);
    await flushPromises();

    expect(sentinel.release).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it('releases a late sentinel after the owning component unmounts', async () => {
    let resolveRequest: (value: Sentinel) => void = () => {
      throw new Error('Wake Lock request has not started');
    };
    const pending = new Promise<Sentinel>((resolve) => {
      resolveRequest = resolve;
    });
    enableWakeLock(pending);
    const wrapper = mount(Harness, { props: { hasMenu: true } });
    await flushPromises();
    wrapper.unmount();

    const sentinel = {
      release: vi.fn(async () => undefined),
      addEventListener: vi.fn(),
    };
    resolveRequest(sentinel);
    await flushPromises();

    expect(sentinel.release).toHaveBeenCalledOnce();
  });
});
