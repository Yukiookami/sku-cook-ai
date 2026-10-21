import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchKitchenChanges } from './kitchen';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(
    public url: string,
    public options: EventSourceInit,
  ) {
    FakeEventSource.instances.push(this);
  }
  message(type: string) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type }) }));
  }
}

describe('厨房实时连接', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it('携带会话连接，只在ready和changed后刷新，心跳不读取菜谱', () => {
    const changed = vi.fn();
    const connection = vi.fn();
    const stop = watchKitchenChanges(changed, connection);
    const source = FakeEventSource.instances[0]!;
    expect(source.url).toBe('/api/kitchen/events');
    expect(source.options).toEqual({ withCredentials: true });
    source.message('ready');
    source.message('heartbeat');
    source.message('changed');
    expect(connection).toHaveBeenCalledWith(true);
    expect(changed).toHaveBeenCalledTimes(2);
    stop();
    source.message('changed');
    expect(changed).toHaveBeenCalledTimes(2);
    expect(source.close).toHaveBeenCalledOnce();
  });
  it('连接失败时报告降级并重连，关闭后不再重连', async () => {
    const connection = vi.fn();
    const stop = watchKitchenChanges(vi.fn(), connection);
    FakeEventSource.instances[0]!.onerror?.();
    expect(connection).toHaveBeenLastCalledWith(false);
    await vi.advanceTimersByTimeAsync(10000);
    expect(FakeEventSource.instances).toHaveLength(2);
    FakeEventSource.instances[0]!.onerror?.();
    FakeEventSource.instances[0]!.message('ready');
    expect(FakeEventSource.instances[1]!.close).not.toHaveBeenCalled();
    stop();
    await vi.advanceTimersByTimeAsync(100000);
    expect(FakeEventSource.instances).toHaveLength(2);
  });
  it('定期会话复验平滑重连，不误显示断线提示，ready后补读', () => {
    const connection = vi.fn();
    const changed = vi.fn();
    const stop = watchKitchenChanges(changed, connection);
    const first = FakeEventSource.instances[0]!;
    first.message('ready');
    first.message('reconnect');
    expect(first.close).toHaveBeenCalledOnce();
    expect(FakeEventSource.instances).toHaveLength(2);
    FakeEventSource.instances[1]!.message('ready');
    expect(connection).not.toHaveBeenCalledWith(false);
    expect(changed).toHaveBeenCalledTimes(2);
    stop();
  });
  it('长时间无心跳时不假装连接正常，心跳会延长存活时间', async () => {
    const connection = vi.fn();
    const stop = watchKitchenChanges(vi.fn(), connection);
    const source = FakeEventSource.instances[0]!;
    source.message('ready');
    await vi.advanceTimersByTimeAsync(60000);
    source.message('heartbeat');
    await vi.advanceTimersByTimeAsync(60000);
    expect(source.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15000);
    expect(source.close).toHaveBeenCalledOnce();
    expect(connection).toHaveBeenLastCalledWith(false);
    stop();
  });
  it('拒绝无效消息并明确降级，不将其当作菜单更新', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const changed = vi.fn();
    const connection = vi.fn();
    const stop = watchKitchenChanges(changed, connection);
    FakeEventSource.instances[0]!.message('invalid');
    expect(warning).toHaveBeenCalledOnce();
    expect(connection).toHaveBeenCalledWith(false);
    expect(changed).not.toHaveBeenCalled();
    stop();
  });
  it('JSON损坏时显式报告降级并关闭连接', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const connection = vi.fn();
    const stop = watchKitchenChanges(vi.fn(), connection);
    const source = FakeEventSource.instances[0]!;
    source.onmessage?.(new MessageEvent('message', { data: 'not json' }));
    expect(warning).toHaveBeenCalledOnce();
    expect(connection).toHaveBeenCalledWith(false);
    expect(source.close).toHaveBeenCalledOnce();
    stop();
  });
  it('不支持EventSource时显式退回定时检查', () => {
    vi.stubGlobal('EventSource', undefined);
    const connection = vi.fn();
    const stop = watchKitchenChanges(vi.fn(), connection);
    expect(connection).toHaveBeenCalledWith(false);
    expect(FakeEventSource.instances).toHaveLength(0);
    stop();
  });
});
