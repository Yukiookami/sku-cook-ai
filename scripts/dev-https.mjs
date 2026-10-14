import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const macTailscale = '/Applications/Tailscale.app/Contents/MacOS/Tailscale';

export function pnpmLaunch(executable) {
  return /\.(?:c|m)?js$/i.test(executable)
    ? { file: process.execPath, args: [executable, 'dev'] }
    : { file: executable, args: ['dev'] };
}

export function privateOrigin(status) {
  if (status.BackendState !== 'Running') {
    throw new Error('Tailscale 未连接，请先打开客户端并登录 Tailnet。');
  }
  const hostname = status.Self?.DNSName?.replace(/\.$/, '');
  if (!hostname || !/^[a-z0-9.-]+\.ts\.net$/i.test(hostname)) {
    throw new Error('未找到有效的 MagicDNS 名称，请在 Tailscale 后台启用 MagicDNS。');
  }
  return `https://${hostname}`;
}

export function serveConfigured(config, origin) {
  if (Object.values(config.AllowFunnel ?? {}).some(Boolean)) {
    throw new Error('检测到 Funnel 公网入口，请先人工关闭；本命令只允许私有 Tailnet 访问。');
  }
  const hostname = new URL(origin).hostname;
  const handlers = config.Web?.[`${hostname}:443`]?.Handlers;
  if (!config.TCP?.['443'] && !handlers) return false;
  if (
    config.TCP?.['443']?.HTTPS &&
    handlers?.['/']?.Proxy === 'http://127.0.0.1:5173' &&
    Object.keys(handlers).length === 1
  ) {
    return true;
  }
  throw new Error('已有不同的 Tailscale Serve 配置；为避免覆盖，请先人工核对 serve status。');
}

async function command(file, args, timeout = 30_000) {
  try {
    const result = await execute(file, args, { cwd: root, timeout });
    return result.stdout;
  } catch (error) {
    throw new Error(
      `${file} ${args.join(' ')} 执行失败：${error.stderr?.trim() || error.message}`,
      { cause: error },
    );
  }
}

async function freePort(port) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', () =>
      reject(new Error(`端口 ${port} 已占用，先确认并停止已有开发服务；不会自动终止它。`)),
    );
    server.listen(port, '0.0.0.0', resolve);
  });
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

export async function waitForServices(check, { attempts = 90, pause = () => delay(1000) } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await check()) return;
    await pause();
  }
  throw new Error('Web/API 启动超时，请检查上方日志、数据库配置和依赖。');
}

async function main() {
  let dev;
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const tailscale =
      process.platform === 'darwin' && existsSync(macTailscale) ? macTailscale : 'tailscale';
    const status = JSON.parse(await command(tailscale, ['status', '--json']));
    const origin = privateOrigin(status);
    serveConfigured(JSON.parse(await command(tailscale, ['serve', 'status', '--json'])), origin);
    const pnpm = process.env.npm_execpath;
    if (!pnpm || !existsSync(pnpm)) throw new Error('请通过 pnpm dev:https 启动本命令。');
    for (const file of ['.env', 'apps/api/.env', 'apps/web/.env']) {
      if (!existsSync(fileURLToPath(new URL(file, pathToFileURL(`${root}/`))))) {
        throw new Error(`缺少 ${file}，请先按 SETUP.md 完成首次初始化。`);
      }
    }
    await Promise.all([freePort(5173), freePort(3000)]);
    console.info('正在启动 PostgreSQL 并等待健康状态（不执行迁移或 Seed）…');
    console.info(
      await command(
        'docker',
        ['compose', 'up', '-d', '--wait', '--wait-timeout', '60', 'postgres'],
        90_000,
      ),
    );
    if (controller.signal.aborted) return;

    console.info('正在启动 Web/API，共用 HTTPS 同站点 /api…');
    const launch = pnpmLaunch(pnpm);
    dev = spawn(launch.file, launch.args, {
      cwd: root,
      stdio: 'inherit',
      // 独立进程组只用于退出时清理本命令创建的开发子进程。
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        APP_ORIGIN: origin,
        HOST: '127.0.0.1',
        PORT: '3000',
        API_PROXY_TARGET: 'http://127.0.0.1:3000',
        VITE_API_BASE_URL: '/api',
      },
    });
    let devError;
    const exited = new Promise((resolve) => {
      dev.once('error', (error) => {
        devError = error;
        resolve();
      });
      dev.once('exit', (code, signal) => {
        devError = new Error(`开发进程退出（code=${code}, signal=${signal}）。`);
        resolve();
      });
    });
    await waitForServices(async () => {
      controller.signal.throwIfAborted();
      if (devError) throw devError;
      try {
        const responses = await Promise.all(
          ['http://127.0.0.1:5173/', 'http://127.0.0.1:5173/api/health'].map((url) =>
            fetch(url, { signal: AbortSignal.timeout(1500) }),
          ),
        );
        return responses.every((response) => response.ok);
      } catch (error) {
        if (error.name === 'TimeoutError' || error.cause?.code === 'ECONNREFUSED') return false;
        throw error;
      }
    });
    controller.signal.throwIfAborted();
    if (
      !serveConfigured(JSON.parse(await command(tailscale, ['serve', 'status', '--json'])), origin)
    ) {
      console.info(await command(tailscale, ['serve', '--bg', '--yes', '--https=443', '5173']));
    }
    if (
      !serveConfigured(JSON.parse(await command(tailscale, ['serve', 'status', '--json'])), origin)
    ) {
      throw new Error('Tailscale 未建立 HTTPS 代理，请检查证书和 Serve 权限。');
    }
    console.info(`\n手机／平板连接 Tailscale 后打开：${origin}`);
    console.info('按 Ctrl+C 停止开发服务；数据库与 Serve 配置保留。电脑休眠后无法访问。');
    await Promise.race([
      exited.then(() => {
        throw devError;
      }),
      new Promise((resolve) => {
        if (controller.signal.aborted) resolve();
        else controller.signal.addEventListener('abort', resolve, { once: true });
      }),
    ]);
  } catch (error) {
    if (!controller.signal.aborted) {
      console.error(`HTTPS 启动失败：${error.message}`);
      process.exitCode = 1;
    }
  } finally {
    if (dev?.pid) {
      if (process.platform === 'win32') {
        try {
          await command('taskkill', ['/PID', String(dev.pid), '/T', '/F']);
        } catch (error) {
          console.error(`开发子进程清理失败：${error.message}`);
          process.exitCode = 1;
        }
      } else {
        try {
          process.kill(-dev.pid, 'SIGTERM');
        } catch (error) {
          if (error.code !== 'ESRCH') {
            console.error(`开发子进程清理失败：${error.message}`);
            process.exitCode = 1;
          }
        }
      }
    }
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
