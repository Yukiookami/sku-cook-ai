import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from './clipboard';

const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');

function mockExecCommand(result: boolean) {
  const execCommand = vi.fn().mockReturnValue(result);
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: execCommand,
  });
  return execCommand;
}

describe('copyTextToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalExecCommand) {
      Object.defineProperty(document, 'execCommand', originalExecCommand);
    } else {
      Reflect.deleteProperty(document, 'execCommand');
    }
  });

  it('uses the native clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const execCommand = mockExecCommand(true);

    await copyTextToClipboard('example');

    expect(writeText).toHaveBeenCalledExactlyOnceWith('example');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('uses the browser fallback when the native clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const execCommand = mockExecCommand(true);

    await copyTextToClipboard('example');

    expect(execCommand).toHaveBeenCalledExactlyOnceWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back when native clipboard access is denied', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('permission denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const execCommand = mockExecCommand(true);

    await copyTextToClipboard('example');

    expect(writeText).toHaveBeenCalledExactlyOnceWith('example');
    expect(execCommand).toHaveBeenCalledExactlyOnceWith('copy');
  });

  it('reports failure when neither copying path succeeds', async () => {
    vi.stubGlobal('navigator', {});
    mockExecCommand(false);

    await expect(copyTextToClipboard('example')).rejects.toThrow('无法复制到剪贴板。');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
