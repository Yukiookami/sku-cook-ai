import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pnpmLaunch, privateOrigin, serveConfigured, waitForServices } from './dev-https.mjs';

const origin = 'https://food.example.ts.net';
const target = {
  TCP: { 443: { HTTPS: true } },
  Web: { 'food.example.ts.net:443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:5173' } } } },
};
const config = { Services: { 'svc:food': target } };
const status = {
  BackendState: 'Running',
  Self: { DNSName: 'device.example.ts.net.', Tags: ['tag:pwa-host'] },
  CurrentTailnet: { MagicDNSSuffix: 'example.ts.net', MagicDNSEnabled: true },
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

test('从 Tailnet 后缀构造 food 服务地址，不依赖设备名', () => {
  assert.equal(privateOrigin(status), origin);
  assert.equal(privateOrigin({ ...status, Self: { Tags: ['tag:other'] } }), origin);
  assert.throws(() => privateOrigin({ BackendState: 'Stopped' }), /未连接/);
  assert.throws(() => privateOrigin({ ...status, Self: { Tags: [] } }), /标签身份/);
  assert.throws(
    () => privateOrigin({ ...status, CurrentTailnet: { MagicDNSSuffix: 'localhost' } }),
    /MagicDNS/,
  );
  assert.throws(
    () =>
      privateOrigin({
        ...status,
        CurrentTailnet: { MagicDNSSuffix: 'example.ts.net', MagicDNSEnabled: false },
      }),
    /MagicDNS/,
  );
});

test('允许空配置或已有同目标代理，不覆盖不同 Serve 配置', () => {
  assert.equal(serveConfigured({}, origin), false);
  const otherPorts = { TCP: { 8443: { HTTPS: true } } };
  assert.equal(serveConfigured(otherPorts, origin), false);
  assert.deepEqual(otherPorts, { TCP: { 8443: { HTTPS: true } } });
  assert.equal(serveConfigured(config, origin), true);
  const unrelated = {
    TCP: { 443: { HTTPS: true } },
    Web: { 'device.example.ts.net:443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:8080' } } } },
    Services: { 'svc:todo': target },
  };
  const before = structuredClone(unrelated);
  assert.equal(serveConfigured(unrelated, origin), false);
  assert.equal(
    serveConfigured(
      { ...unrelated, Services: { ...unrelated.Services, ...config.Services } },
      origin,
    ),
    true,
  );
  assert.deepEqual(unrelated, before);
  const other = structuredClone(config);
  other.Services['svc:food'].Web['food.example.ts.net:443'].Handlers['/'].Proxy =
    'http://127.0.0.1:8080';
  assert.throws(() => serveConfigured(other, origin), /已有不同/);
  assert.throws(() => serveConfigured({ Services: { 'svc:food': {} } }, origin), /已有不同/);
});

test('拒绝公开 Funnel，即使 Serve 目标一致', () => {
  assert.throws(
    () => serveConfigured({ ...config, AllowFunnel: { 'food.example.ts.net:443': true } }, origin),
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
