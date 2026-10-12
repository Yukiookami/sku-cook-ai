export async function copyTextToClipboard(text: string): Promise<void> {
  let clipboardError: unknown;
  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (cause) {
      clipboardError = cause;
    }
  }

  if (typeof document.execCommand !== 'function') {
    throw new Error('当前浏览器不支持剪贴板复制。', { cause: clipboardError });
  }

  const activeElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.opacity = '0';

  let copied: boolean;
  try {
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    copied = document.execCommand('copy');
  } catch (cause) {
    throw new Error('无法复制到剪贴板。', { cause });
  } finally {
    textarea.remove();
    if (activeElement?.isConnected) activeElement.focus();
  }

  if (!copied) {
    throw new Error('无法复制到剪贴板。', { cause: clipboardError });
  }
}
