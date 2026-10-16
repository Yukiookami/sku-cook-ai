(() => {
  const screen = document.getElementById('startup-screen');
  const message = document.getElementById('startup-message');
  const retry = document.getElementById('startup-retry');
  if (!screen || !message || !retry) return;
  const resuming = document.documentElement.hasAttribute('data-startup-resume');
  let startedAt;
  let readyReceived = false;
  let leaving = false;
  let removalTimer;
  let minimumTimer;
  const fail = () => {
    if (leaving || readyReceived) return;
    document.documentElement.removeAttribute('data-startup-resume');
    screen.classList.add('is-failed');
    message.textContent = '小厨房暂时没准备好，请检查网络后重新加载。';
    retry.hidden = false;
  };
  const timeout = setTimeout(fail, 15000);
  const remove = () => {
    clearTimeout(removalTimer);
    clearTimeout(minimumTimer);
    clearTimeout(timeout);
    screen.remove();
    window.removeEventListener('app:startup-ready', ready);
    window.removeEventListener('app:startup-failed', fail);
    window.removeEventListener('pagehide', suspend);
    document.removeEventListener('visibilitychange', visibilityChanged);
  };
  const leave = (immediate = false) => {
    leaving = true;
    document.getElementById('app')?.removeAttribute('inert');
    if (immediate) {
      remove();
      return;
    }
    screen.classList.add('is-leaving');
    screen.setAttribute('aria-hidden', 'true');
    screen.addEventListener(
      'transitionend',
      (event) => {
        if (event.target === screen) remove();
      },
      { once: true },
    );
    removalTimer = setTimeout(remove, 280);
  };
  const finish = () => {
    if (!readyReceived || startedAt === undefined || leaving || minimumTimer) return;
    const remaining = 1500 - (performance.now() - startedAt);
    if (remaining > 0) minimumTimer = setTimeout(() => leave(), remaining);
    else leave();
  };
  const ready = () => {
    if (readyReceived) return;
    readyReceived = true;
    clearTimeout(timeout);
    try {
      sessionStorage.setItem('sku-cook-ai:startup-ready', 'true');
    } catch (error) {
      console.warn('无法保存启动会话，下次载入可能再次显示开屏。', error);
    }
    if (resuming || document.visibilityState === 'hidden') leave(true);
    else finish();
  };
  const suspend = () => {
    if (readyReceived) leave(true);
  };
  const visibilityChanged = () => {
    if (document.visibilityState === 'hidden') suspend();
  };
  requestAnimationFrame(() => {
    startedAt = performance.now();
    finish();
  });
  retry.addEventListener('click', () => window.location.reload());
  window.addEventListener('app:startup-ready', ready);
  window.addEventListener('app:startup-failed', fail);
  window.addEventListener('pagehide', suspend);
  document.addEventListener('visibilitychange', visibilityChanged);
})();
