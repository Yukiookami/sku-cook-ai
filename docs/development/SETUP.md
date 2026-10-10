# 本地启动指南

除特别注明外，以下命令从仓库根目录执行。macOS 命令适用于 zsh；Windows 命令适用于 PowerShell。

## 平时启动

当前本地开发环境此前已完成依赖安装、数据库迁移和 Seed。若没有主动删除数据库数据，之后每次启动通常只需要：

```sh
docker compose up -d postgres
docker compose ps
pnpm dev
```

确认 `docker compose ps` 中 PostgreSQL 状态为 `healthy` 后，在浏览器打开：

- Web：<http://localhost:5173>
- API 健康检查：<http://127.0.0.1:3000/api/health>

`pnpm dev` 会先构建 shared，再启动 shared 监听、Web 和 API。该命令保持前台运行，关闭终端或按 `Ctrl+C` 会停止开发进程。数据库容器可以继续运行；需要停止时执行：

```sh
docker compose stop postgres
```

再次启动仍执行 `docker compose up -d postgres`。不要用 `docker compose down -v`，它会删除数据库 Volume 和其中的数据。

## Windows 上通过 Tailscale 使用 iPhone

Tailscale Serve 可将本机 Web 开发服务器以仅限 Tailnet 访问的 HTTPS 地址提供给手机；不要使用 Funnel，也不要把 API 或 PostgreSQL 端口转发到公网。

1. Windows 和 iPhone 的 Tailscale 均登录同一个 Tailnet，确认两台设备在线。
2. 在 Tailscale 管理后台启用 MagicDNS 和 HTTPS Certificates；如果命令提示未启用证书，按提示检查 DNS 设置。
3. 保持 PostgreSQL 与 `pnpm dev` 运行，在仓库根目录执行：

   ```powershell
   tailscale serve --bg 5173
   tailscale serve status
   ```

   使用状态输出中的 HTTPS MagicDNS 地址。开发服务停止时，手机上的页面也会暂时无法访问。若要移除 Serve 配置，执行 `tailscale serve reset`。

4. iPhone 连上 Tailscale 后，在 Safari 打开该 HTTPS 地址，点“分享”→“添加到主屏幕”；若出现“作为 Web App 打开”选项，保持开启。Android 连上 Tailscale 后，在 Chrome 打开同一地址，通过菜单选择“安装应用”或“添加到主屏幕”。

iPhone 使用 HTML 中的 Apple touch icon。当前 `pnpm dev` 开发服务不会注入生产 Web App Manifest，因此 Android Chrome 可能只提供普通快捷方式；Android 的完整 PWA 安装与图标需在带 HTTPS 的生产构建环境验收。若图标更新前已经安装，可先移除旧桌面入口/应用，再重新添加；系统可能缓存已安装应用的图标。此处仍连接 Windows 上正在运行的本地开发环境；不是公网部署，离线写入也不受支持。

## 首次初始化或新克隆仓库

### 1. 准备运行环境

- Node.js `24.20.0` 以上、`25` 以下；仓库 `.node-version` 固定为 `24.20.0`。
- pnpm `12.10.1`，版本由根目录 `package.json` 固定。
- Docker Desktop（用于本地 PostgreSQL）。

在 macOS 上，如果已安装 nvm，可在仓库根目录切换到项目指定版本，再安装指定 pnpm：

```sh
nvm install 24.20.0
nvm use 24.20.0
npm install --global pnpm@12.10.1
```

在 Windows 上通过 Node.js 安装程序或版本管理器安装兼容的 Node.js，再运行 `npm install --global pnpm@12.10.1`。两种系统均可用以下命令检查：

```sh
node --version
pnpm --version
docker compose version
```

继续前确认 Node.js 版本不低于 `24.20.0` 且小于 `25`，pnpm 为 `12.10.1`。在 Mac 新开终端后如果仍报 `/usr/local/bin/pnpm: No such file or directory`，先执行 `exec zsh -l` 进入已加载 nvm 配置的登录 zsh，再检查版本；不要继续使用旧 Bash 会话里的 pnpm 路径。

### 2. 安装依赖并准备本地配置

在 macOS / Linux（zsh、bash）的仓库根目录运行。下面的复制命令只在文件不存在时执行，不会覆盖已有的本地配置：

```sh
[ -f .env ] || cp .env.example .env
[ -f apps/api/.env ] || cp apps/api/.env.example apps/api/.env
[ -f apps/web/.env ] || cp apps/web/.env.example apps/web/.env
pnpm install --frozen-lockfile
pnpm db:generate
```

Windows PowerShell 使用以下复制命令，再执行相同的 `pnpm install --frozen-lockfile` 和 `pnpm db:generate`：

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path apps\api\.env)) { Copy-Item apps\api\.env.example apps\api\.env }
if (-not (Test-Path apps\web\.env)) { Copy-Item apps\web\.env.example apps\web\.env }
```

三个 `.env` 文件用途不同：根目录 `.env` 给 Docker Compose 使用；`apps/api/.env` 给 API 和 Prisma 使用；`apps/web/.env` 配置 Vite。确保 API 的 `DATABASE_URL` 与根目录 `.env` 中数据库名、用户名、密码和端口一致；连接字符串中的特殊密码字符要进行 URL 编码。真实 `.env` 不提交 Git，也不要把密码复制到文档或聊天记录。

### 3. 初始化本地数据库

```sh
docker compose up -d postgres
docker compose ps
pnpm --filter @sku-cook/api db:deploy
pnpm db:seed
```

`db:deploy` 只应用仓库已有的迁移；`db:seed` 使用 upsert 准备默认用户，可安全重复执行。仅在新数据库或项目新增迁移后执行数据库初始化步骤；日常启动不需要重复迁移或 Seed。如果 Prisma 提示需要重置数据库才能继续，请停止操作并先确认原因，不要执行会清空数据的命令。

## 常见问题

- PostgreSQL 尚未 `healthy`：等待片刻后再运行 `docker compose ps`；也可查看 `docker compose logs postgres`。
- `pnpm` 提示 `/usr/local/bin/pnpm: No such file or directory`：在 Mac 新终端执行 `exec zsh -l`，并确认 `node --version` 与 `pnpm --version` 符合项目要求。
- 在 macOS 终端执行 `Test-Path` 或 `Copy-Item` 报语法错误：这些是 PowerShell 命令；macOS 请使用首次初始化第 2 步中的 `cp` 命令。
- API 数据库连接失败：确认 PostgreSQL 已健康，并检查根目录 `.env` 与 `apps\api\.env` 的数据库连接信息是否一致。
- Web 能打开但 API 不通：查看运行 `pnpm dev` 的终端输出；健康检查地址为 <http://127.0.0.1:3000/api/health>。
- 5173、3000 或 5432 端口已被占用：先确认占用进程是否是本项目，不要直接终止不明进程。
