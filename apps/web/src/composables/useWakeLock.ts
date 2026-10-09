import { onBeforeUnmount, watch, type Ref } from 'vue';

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
};

export function useWakeLock(hasMenu: Ref<boolean>, unavailable: Ref<boolean>) {
  let sentinel: WakeLockSentinelLike | null = null;
  let requestInFlight = false;
  let disposed = false;
  let requestSequence = 0;

  async function release() {
    requestSequence += 1;
    const current = sentinel;
    sentinel = null;
    if (current) await current.release().catch(() => undefined);
  }

  async function request() {
    if (disposed || !hasMenu.value || document.visibilityState !== 'visible') {
      await release();
      return;
    }
    const wakeLockNavigator: WakeLockNavigator = navigator;
    if (!window.isSecureContext || !wakeLockNavigator.wakeLock) {
      unavailable.value = true;
      return;
    }
    if (sentinel || requestInFlight) return;
    requestInFlight = true;
    const sequence = ++requestSequence;
    let acquired: WakeLockSentinelLike | undefined;
    try {
      acquired = await wakeLockNavigator.wakeLock.request('screen');
    } catch {
      if (
        sequence === requestSequence &&
        !disposed &&
        hasMenu.value &&
        document.visibilityState === 'visible'
      ) {
        unavailable.value = true;
      }
    } finally {
      requestInFlight = false;
    }
    if (!acquired) return;
    if (
      disposed ||
      sequence !== requestSequence ||
      !hasMenu.value ||
      document.visibilityState !== 'visible'
    ) {
      await acquired.release().catch(() => undefined);
      if (!disposed && hasMenu.value && document.visibilityState === 'visible') {
        void request();
      }
      return;
    }
    sentinel = acquired;
    sentinel.addEventListener('release', () => {
      sentinel = null;
      if (!disposed && hasMenu.value && document.visibilityState === 'visible') void request();
    });
    unavailable.value = false;
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') void request();
    else void release();
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  watch(
    hasMenu,
    (value) => {
      if (value) void request();
      else void release();
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    disposed = true;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    void release();
  });
}
