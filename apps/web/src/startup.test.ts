import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve('index.html'), 'utf8');
const script = readFileSync(resolve('public/startup.js'), 'utf8');
const sessionScript = html.match(/<script id="startup-session">([\s\S]*?)<\/script>/)?.[1] ?? '';
const sessionKey = 'sku-cook-ai:startup-ready';

describe('启动开屏', () => {
  let listeners: Map<string, EventListener>;
  let animationFrameCallbacks: FrameRequestCallback[];
  let elapsed: number;
  const reload = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    reload.mockClear();
    window.sessionStorage.clear();
    document.documentElement.removeAttribute('data-startup-resume');
    document.head.innerHTML = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
    vi.spyOn(document, 'addEventListener');
    listeners = new Map();
    animationFrameCallbacks = [];
    elapsed = 0;
    start();
  });
  function start() {
    animationFrameCallbacks = [];
    if (sessionScript) {
      runInNewContext(sessionScript, {
        document,
        sessionStorage: window.sessionStorage,
        console,
      });
    }
    runInNewContext(script, {
      document,
      Date,
      console,
      sessionStorage: window.sessionStorage,
      performance: { now: () => elapsed },
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        animationFrameCallbacks.push(callback);
        return animationFrameCallbacks.length;
      },
      setTimeout,
      clearTimeout,
      window: {
        addEventListener: (name: string, handler: EventListener) => listeners.set(name, handler),
        removeEventListener: (name: string) => listeners.delete(name),
        location: { reload },
      },
    });
  }
  afterEach(() => {
    for (const [name, listener] of vi.mocked(document.addEventListener).mock.calls) {
      if (name === 'visibilitychange') document.removeEventListener(name, listener);
    }
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    document.documentElement.removeAttribute('data-startup-resume');
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });
  function emit(name: string) {
    listeners.get(name)?.(new Event(name));
  }
  function renderFirstFrame() {
    animationFrameCallbacks.shift()?.(0);
  }
  function advanceTime(milliseconds: number) {
    elapsed += milliseconds;
    vi.advanceTimersByTime(milliseconds);
  }
  it('在应用模块前提供品牌、插画与加载提示，不依赖 Vue', () => {
    expect(html.indexOf('id="startup-screen"')).toBeLessThan(html.indexOf('src="/src/main.ts"'));
    expect(document.querySelector('#startup-screen h1')?.textContent).toBe('吃什么饭');
    expect(document.querySelector('#startup-retry')).toHaveProperty('hidden', true);
  });
  it('开屏从首帧开始显示，应用快速就绪后保持清晰的最短展示时间再淡出', () => {
    expect(document.querySelector('#startup-screen')?.hasAttribute('hidden')).toBe(false);
    expect(document.getElementById('app')?.hasAttribute('inert')).toBe(true);
    emit('app:startup-ready');
    renderFirstFrame();
    advanceTime(1499);
    expect(document.querySelector('#startup-screen')?.classList.contains('is-leaving')).toBe(false);
    advanceTime(1);
    expect(document.getElementById('app')?.hasAttribute('inert')).toBe(false);
    expect(document.querySelector('#startup-screen')?.classList.contains('is-leaving')).toBe(true);
    vi.advanceTimersByTime(280);
    expect(document.querySelector('#startup-screen')).toBeNull();
    expect(listeners.size).toBe(0);
  });
  it('慢启动时不会在页面渲染后再覆盖开屏，应用就绪后立即淡出', () => {
    renderFirstFrame();
    advanceTime(1700);
    emit('app:startup-ready');
    expect(document.querySelector('#startup-screen')?.classList.contains('is-leaving')).toBe(true);
    expect(document.getElementById('app')?.hasAttribute('inert')).toBe(false);
    vi.advanceTimersByTime(280);
    expect(document.querySelector('#startup-screen')).toBeNull();
  });
  it('加载超时不无限遮挡，显示失败与重新加载操作，晚到的就绪仍可退出', () => {
    renderFirstFrame();
    advanceTime(15000);
    expect(document.querySelector('#startup-message')?.textContent).toContain('检查网络');
    expect(document.querySelector('#startup-retry')).toHaveProperty('hidden', false);
    document.getElementById('startup-retry')?.click();
    expect(reload).toHaveBeenCalledOnce();
    emit('app:startup-ready');
    advanceTime(280);
    expect(document.querySelector('#startup-screen')).toBeNull();
  });
  it('启动明确失败时立即显示恢复操作', () => {
    renderFirstFrame();
    emit('app:startup-failed');
    expect(document.querySelector('#startup-retry')).toHaveProperty('hidden', false);
    expect(window.sessionStorage.getItem(sessionKey)).toBeNull();
  });

  it('在解析业务页面前识别已启动会话，恢复文档从首帧起就不显示品牌开屏', () => {
    emit('app:startup-ready');
    expect(window.sessionStorage.getItem(sessionKey)).toBe('true');
    vi.clearAllTimers();
    listeners.clear();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
    start();

    expect(sessionScript).not.toBe('');
    expect(html.indexOf('id="startup-session"')).toBeLessThan(html.indexOf('<body>'));
    expect(getComputedStyle(document.getElementById('startup-screen')!).display).toBe('none');
    expect(document.getElementById('app')?.hasAttribute('inert')).toBe(true);
    emit('app:startup-ready');
    expect(document.getElementById('startup-screen')).toBeNull();
    expect(document.getElementById('app')?.hasAttribute('inert')).toBe(false);
  });

  it('应用就绪后进入后台会立即结束开屏，不把剩余展示时间带到下次打开', () => {
    renderFirstFrame();
    emit('app:startup-ready');
    advanceTime(100);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(document.getElementById('startup-screen')).toBeNull();
    expect(document.getElementById('app')?.hasAttribute('inert')).toBe(false);
    advanceTime(30000);
    emit('pageshow');
    expect(document.getElementById('startup-screen')).toBeNull();
  });

  it('在已就绪但首帧回调尚未运行时离开，也不会保留开屏等回来再播放', () => {
    emit('app:startup-ready');
    emit('pagehide');
    expect(document.getElementById('startup-screen')).toBeNull();
    renderFirstFrame();
    advanceTime(30000);
    expect(document.getElementById('startup-screen')).toBeNull();
  });

  it('恢复启动失败仍展示可见错误与重试，不因跳过品牌开屏而隐藏失败', () => {
    vi.clearAllTimers();
    listeners.clear();
    window.sessionStorage.setItem(sessionKey, 'true');
    start();
    expect(getComputedStyle(document.getElementById('startup-screen')!).display).toBe('none');
    emit('app:startup-failed');
    expect(getComputedStyle(document.getElementById('startup-screen')!).display).not.toBe('none');
    expect(document.querySelector('#startup-retry')).toHaveProperty('hidden', false);
    emit('app:startup-ready');
    expect(document.getElementById('startup-screen')).toBeNull();
  });

  it('后台加载就绪时不等待首帧或最短时长，恢复时直接进入页面', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    emit('app:startup-ready');
    expect(document.getElementById('startup-screen')).toBeNull();
    expect(document.getElementById('app')?.hasAttribute('inert')).toBe(false);
    expect(window.sessionStorage.getItem(sessionKey)).toBe('true');
  });

  it('会话存储受限时明确记录降级，但不阻止应用启动', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('storage blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('storage blocked', 'SecurityError');
    });
    vi.clearAllTimers();
    listeners.clear();
    start();
    emit('app:startup-ready');
    renderFirstFrame();
    advanceTime(1780);
    expect(document.getElementById('startup-screen')).toBeNull();
    expect(document.getElementById('app')?.hasAttribute('inert')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
