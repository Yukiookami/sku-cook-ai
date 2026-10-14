# 本地启动指南

除特别注明外，以下命令从仓库根目录执行。macOS 命令适用于 zsh；Windows 命令适用于 PowerShell。

## 平时启动

当前本地开发环境此前已完成依赖安装、数据库迁移和 Seed。若没有主动删除数据库数据，之后每次启动通常只需要：

**手机／平板通过 Tailnet HTTPS 使用时，推荐一条命令启动（macOS / Windows）：**

```sh
pnpm dev:https
```

**当前 Mac 的唯一设备访问入口：<https://shiro-mac-home.taila48442.ts.net>**

手机／平板必须连接同一 Tailnet。Web 的 5173 和 API 的 3000 均仅监听本机 `127.0.0.1`，不再提供局域网 IP／Tailscale IP 的 HTTP 直连入口。Tailscale 到本机的 HTTP 仅作为内部反向代理链路保留，不能关闭，否则 HTTPS 也无法工作；日常统一使用上述 HTTPS 地址。换电脑启动时，以命令打印的新地址为准。

前提是 Docker Desktop 已启动，电脑的 Tailscale 已登录并连接，且已完成下方首次初始化及 HTTPS 设置。命令自动检查端口和既有 Serve 配置、启动 PostgreSQL 并等待健康状态、运行 `pnpm dev`、等待 Web 与 `/api/health` 代理就绪，然后配置私有 HTTPS 并打印实际地址。不安装依赖、不修改 `.env`、不执行迁移或 Seed，也不会覆盖冲突的 Serve 配置或终止已有服务。后端业务与数据库验收仍需单独执行，启动检查不等于完整业务验收。

启动进程使用该 HTTPS 地址作为 `APP_ORIGIN`，并临时固定 API 为 `127.0.0.1:3000`、Web API 为同站点 `/api`，不覆盖配置文件。macOS 自动使用已安装的 Tailscale App 内置 CLI；Windows / Linux 需确保 `tailscale` 可在终端执行。按 `Ctrl+C` 停止本命令创建的开发进程，数据库和后台 Serve 配置保留；没有 Web 服务时 HTTPS 入口不会继续提供页面。再次运行同一命令即可恢复。电脑必须开机且不休眠。

仅电脑本机调试时，仍可使用原有命令（不会开放手机 HTTP 访问）：

```sh
docker compose up -d postgres
docker compose ps
pnpm dev
```

确认 `docker compose ps` 中 PostgreSQL 状态为 `healthy` 后，仅本机调试可打开（不是手机／平板入口）：

- Web：<http://127.0.0.1:5173>
- API 健康检查：<http://127.0.0.1:3000/api/health>

`pnpm dev` 会先构建 shared，再启动 shared 监听、Web 和 API。该命令保持前台运行，关闭终端或按 `Ctrl+C` 会停止开发进程。数据库容器可以继续运行；需要停止时执行：

```sh
docker compose stop postgres
```

再次启动仍执行 `docker compose up -d postgres`。不要用 `docker compose down -v`，它会删除数据库 Volume 和其中的数据。

## 首次设置 Tailnet HTTPS（macOS / Windows、iPhone / Android）

Tailscale Serve 可将本机 Web 开发服务器以仅限 Tailnet 访问的 HTTPS 地址提供给手机；不要使用 Funnel，也不要把 API 或 PostgreSQL 端口转发到公网。

1. 运行项目的电脑和手机／平板均安装 Tailscale 并加入同一个 Tailnet，确认设备在线；家人可通过邀请加入，并按 Tailnet 访问策略限制权限。
2. 在 Tailscale 管理后台启用 MagicDNS 和 HTTPS Certificates，并允许当前用户使用 Serve；如果命令提示未启用或没有权限，按提示完成后台设置后再运行。
3. 完成首次初始化后，在仓库根目录执行 `pnpm dev:https`。终端打印的 `https://<电脑名>.<Tailnet名>.ts.net` 就是访问入口。该命令通过 `tailscale serve --bg --yes --https=443 5173` 建立代理，只在 443 未占用时创建；既有同目标配置会复用，443 冲突时停止而不是重置，其他端口的 Serve 配置保留。

   若需要手动管理，可使用以下命令；macOS 没有 `tailscale` 命令时，将它替换为 `/Applications/Tailscale.app/Contents/MacOS/Tailscale`：

   ```powershell
   tailscale serve status
   ```

   使用状态输出中的 HTTPS MagicDNS 地址。若要移除本项目的 443 根路径代理，可执行 `tailscale serve --https=443 off`；操作前核对配置，不使用 `serve reset` 清空其他服务。不要启用 Funnel。

4. iPhone 连上 Tailscale 后，在 Safari 打开该 HTTPS 地址，点“分享”→“添加到主屏幕”；若出现“作为 Web App 打开”选项，保持开启。Android 连上 Tailscale 后，在 Chrome 打开同一地址，通过菜单选择“安装应用”或“添加到主屏幕”。

iPhone 使用 HTML 中的 Apple touch icon。`pnpm dev` 与生产构建提供同一份 Web App Manifest，明确使用 `start_url: "/"`、`scope: "/"` 和 `display: "standalone"`，覆盖菜谱、厨房与历史路由；开发环境只提供安装元数据，不注册 Service Worker。Android 的完整 PWA 安装仍需在带 HTTPS 的生产构建环境验收。

旧主屏幕入口可能保留添加时的导航范围。如果从首页进入厨房或历史页出现带关闭按钮的浏览器窗口，请先移除旧主屏幕入口，在 Safari 打开当前设备的同一地址，再重新“添加到主屏幕”，保持“作为 Web App 打开”开启。重新安装后验证首页、厨房和历史均留在独立应用内；不同主机名、IP、协议或端口仍是不同站点，不能混用。HTTP 下 iOS 是否采用 Manifest 范围需要真机确认；如仍无法正常使用，应在同一设备的 Tailscale HTTPS 地址重新安装验证，而不是通过 CSS 隐藏系统工具栏。

此处仍连接本机正在运行的开发环境；不是公网部署，离线写入也不受支持。

从 HTTP 改为 HTTPS 是不同站点：需要重新登录、重新添加主屏幕入口，本地模式偏好不会自动迁移；服务端菜谱、账号、外卖等数据库数据不受影响。通过 HTTPS 访问可满足剪贴板、厨房常亮等安全上下文要求，实际设备能力仍需真机确认。`pnpm dev:https` 不会改变开发环境不注册 Service Worker 的行为；完整 PWA 需另行使用生产构建验收。

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

首次 Seed 前，先在未跟踪的 `apps/api/.env` 中设置 `BOOTSTRAP_USER_PASSWORD`（8–128 个字符且不全为空白）；不要将真实密码写入命令历史、文档或提交。`db:deploy` 只应用仓库已有的迁移；`db:seed` 使用 upsert 准备 Sku001，可安全重复执行且不会覆盖已设置密码。仅在新数据库或项目新增迁移后执行数据库初始化步骤；日常启动不需要重复迁移或 Seed。升级已有数据库前先按 [API 认证迁移说明](../../apps/api/README.md)确认目标并备份。如果 Prisma 提示需要重置数据库才能继续，请停止操作并先确认原因，不要执行会清空数据的命令。

## 常见问题

### 邮箱登录与管理员升级

新增管理员迁移保留所有用户ID、密码、会话和业务数据，仅原id=1账号升级为唯一超级管理员；用户名已修改时仍按ID升级。新注册必须邮箱，旧账号无邮箱仍可用用户名登录，不发送验证邮件。管理员只读用户列表从首页“更多”进入。

已有数据库先备份再运行 `pnpm --filter @sku-cook/api db:deploy`，然后 `pnpm db:generate`，停止并重新执行 `pnpm dev` 以加载新版Prisma Client。管理员真实邮箱不写进源码或迁移，在确认环境后私下按id=1更新数据库；不要复制他人的真实邮箱配置。邮箱须小写、合法且未被其他用户占用。重复Seed不改已有管理员邮箱或密码。

- PostgreSQL 尚未 `healthy`：等待片刻后再运行 `docker compose ps`；也可查看 `docker compose logs postgres`。
- `pnpm` 提示 `/usr/local/bin/pnpm: No such file or directory`：在 Mac 新终端执行 `exec zsh -l`，并确认 `node --version` 与 `pnpm --version` 符合项目要求。
- 在 macOS 终端执行 `Test-Path` 或 `Copy-Item` 报语法错误：这些是 PowerShell 命令；macOS 请使用首次初始化第 2 步中的 `cp` 命令。
- API 数据库连接失败：确认 PostgreSQL 已健康，并检查根目录 `.env` 与 `apps\api\.env` 的数据库连接信息是否一致。
- Web 能打开但 API 不通：查看运行 `pnpm dev` 的终端输出；健康检查地址为 <http://127.0.0.1:3000/api/health>。
- 5173、3000 或 5432 端口已被占用：先确认占用进程是否是本项目，不要直接终止不明进程。
- `pnpm dev:https` 提示 Tailscale 未连接或 CLI 不存在：先安装并打开客户端、登录 Tailnet；Windows / Linux 确认 CLI 在 PATH 中。
- HTTPS 命令提示已有不同 Serve 配置或 Funnel：先查看 `tailscale serve status` 并人工协调已有服务，不要直接重置或覆盖。
- HTTPS 登录／写入报来源错误：确认使用命令输出的同一 HTTPS 地址，并由 `pnpm dev:https` 启动；该命令的 `APP_ORIGIN` 只允许此入口写入，本机 HTTP 地址不作为同一写入来源。
