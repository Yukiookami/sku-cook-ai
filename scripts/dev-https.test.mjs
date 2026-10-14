import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pnpmLaunch, privateOrigin, serveConfigured, waitForServices } from './dev-https.mjs';

const origin = 'https://device.example.ts.net';
const config = {
  TCP: { 443: { HTTPS: true } },
  Web: { 'device.example.ts.net:443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:5173' } } } },
};

test('同时支持 pnpm JavaScript CLI 与独立可执行文件', () => {
  assert.deepEqual(pnpmLaunch('/tools/pnpm.cjs'), {
    file: process.execPath,
    args: ['/tools/pnpm.cjs', 'dev'],
  });
  assert.deepEqual(pnpmLaunch('/tools/pnpm'), { file: '/tools/pnpm', args: ['dev'] });
  assert.deepEqual(pnpmLaunch('C:\\tools\\pnpm.exe'), {
    file: 'C:\\tools\\pnpm.exe',
    args: ['dev'],
  });
});

test('从连接中的 Tailscale 状态读取 HTTPS 地址', () => {
  assert.equal(
    privateOrigin({ BackendState: 'Running', Self: { DNSName: 'device.example.ts.net.' } }),
    origin,
  );
  assert.throws(() => privateOrigin({ BackendState: 'Stopped' }), /未连接/);
  assert.throws(
    () => privateOrigin({ BackendState: 'Running', Self: { DNSName: 'localhost' } }),
    /MagicDNS/,
  );
});

test('允许空配置或已有同目标代理，不覆盖不同 Serve 配置', () => {
  assert.equal(serveConfigured({}, origin), false);
  const otherPorts = { TCP: { 8443: { HTTPS: true } } };
  assert.equal(serveConfigured(otherPorts, origin), false);
  assert.deepEqual(otherPorts, { TCP: { 8443: { HTTPS: true } } });
  assert.equal(serveConfigured(config, origin), true);
  assert.throws(
    () => serveConfigured({ TCP: { 443: { TCPForward: 'localhost:8080' } } }, origin),
    /已有不同/,
  );
  const other = structuredClone(config);
  other.Web['device.example.ts.net:443'].Handlers['/'].Proxy = 'http://127.0.0.1:8080';
  assert.throws(() => serveConfigured(other, origin), /已有不同/);
});

test('拒绝公开 Funnel，即使 Serve 目标一致', () => {
  assert.throws(
    () =>
      serveConfigured({ ...config, AllowFunnel: { 'device.example.ts.net:443': true } }, origin),
    /Funnel/,
  );
});

test('等待 Web 与 API 就绪，重试后成功', async () => {
  let attempts = 0;
  await waitForServices(async () => ++attempts === 3, { pause: async () => {} });
  assert.equal(attempts, 3);
});

test('超时或开发进程失败不返回启动成功', async () => {
  await assert.rejects(
    waitForServices(async () => false, { attempts: 2, pause: async () => {} }),
    /启动超时/,
  );
  await assert.rejects(
    waitForServices(async () => {
      throw new Error('开发进程退出');
    }),
    /开发进程退出/,
  );
});
