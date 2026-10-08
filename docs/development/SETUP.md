# 基础工程启动

## 环境

- Node.js 22 LTS，最低 22.18.0；本次初始化使用 22.18.0。
- pnpm 10.34.6（根目录 packageManager 固定版本）。
- Docker Desktop + Compose，仅数据库启动需要。未安装 Docker 时仍可验证 health 和前端联通，但不能认为数据库已经就绪。

若没有 pnpm，执行 `npm install --global pnpm@10.34.6`，或通过 Corepack 启用 pnpm 命令。根脚本会调用 pnpm，因此需要确保 `pnpm --version` 能直接执行。不需要全局安装 Vue、Vite、Prisma 或 TypeScript。

## 配置与数据库

在仓库根目录执行：

```powershell
Copy-Item .env.example .env
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env
```

修改根目录 `.env` 的开发数据库密码，并让 API 的 `DATABASE_URL` 使用相同的用户名、密码、数据库名和端口。密码里的特殊字符需要 URL 编码。真实 `.env` 不提交。

Compose 加载根目录 `.env`；API 和 Prisma 在 apps/api 的工作目录加载其 `.env`；Vite 加载 apps/web 的 `.env`。三者不是同一个文件。

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
docker compose up -d
pnpm db:migrate --name init
pnpm db:seed
```

Seed 使用 upsert，再次执行不新增默认用户。迁移由 Prisma 根据模型生成，需要可连接的本地 PostgreSQL；不要在数据库不可用时伪造迁移文件。默认用户 id 为 1，camelCase 字段映射为数据库 snake_case。

## 开发

```powershell
pnpm dev
```

- Web：http://localhost:5173
- API：http://127.0.0.1:3000/api/health
- 首页点击“检查后端连接”，通过 Vite 的 `/api` 代理请求 API。
- health 只验证进程与共享 Contract，不查询数据库。数据库初始化和 Seed 必须单独验收。

根 dev 命令先构建 shared，再并行启动 shared 的 TypeScript watch、Web 和 API。shared 显式导出编译后的 JavaScript 与类型，生产 API 不依赖源码路径别名。

手机或平板通过开发电脑的局域网 IP 访问 5173，需要 Windows 防火墙允许 Web 端口。API 默认只监听本机，由 Vite 代理访问；PostgreSQL 只绑定 127.0.0.1，不对家庭设备开放。

## 验证与生产构建

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm --filter @sku-cook/api start
```

单独启动生产 API 前需要先构建 shared 和 API。前端产物在 apps/web/dist，API 在 apps/api/dist。生产入口需要由实际 Web 服务器提供前端并将 `/api` 转给 API；Vite preview 不是正式部署服务器。

PWA 只缓存静态资源，不缓存业务 API。新版本准备好后显示刷新按钮，不强制打断用户。PWA 安装、Service Worker 与未来厨房页 Wake Lock 需要 HTTPS 安全上下文；局域网 HTTP 只验收网页联通。PWA 图标属于应用安装资源，不是 V1 菜谱图片功能。

## 本次范围

已建立 workspace、首页、API health、统一错误处理、默认用户模型与 Seed、Prisma 配置、PWA 基础、检查命令与测试。菜谱业务、厨房页、Wake Lock、Fully Kiosk、图片存储和按需 AI 配置未实现。

Prisma 使用 6.19.3，并且 CLI 与 Client 版本一致。其 PostgreSQL 内置连接方案不需要额外驱动 adapter；以后升级 Prisma 大版本时单独评估配置迁移。SCSS 目前没有使用，不安装 Sass；Pino 使用 Fastify 的内置集成，不重复建立日志系统。

安装后需要运行 `pnpm db:generate`。pnpm 只允许 Prisma 与 esbuild 的必要安装脚本执行；依赖实际版本由 pnpm-lock.yaml 锁定。ESLint 采用兼容 Node 22.18 的 10.x，避免使用已停止支持的 9.x。

## 初始化验证记录

- 依赖安装、frozen-lockfile 重装、Prisma Client 生成与 Schema 校验通过。
- 类型检查、lint、格式检查、三个包的生产构建通过；Web 已生成 Manifest、Service Worker 和安装图标。
- 10 个测试通过：共享 Contract 2 个、API 与配置 6 个、首页组件 2 个。
- 编译后的 API health、Vite `/api` 代理和浏览器首页按钮联通通过。
- 本机未安装 Docker，数据库容器、实际迁移与 Seed 幂等性尚未验证；安装 Docker 后按上面的命令完成。
- 平板访问、HTTPS 下的 PWA 安装/更新和 Wake Lock 尚未实测。Wake Lock 与厨房业务页在后续业务阶段实现。
- 仓库已有的 README 删除状态未改动。现已建立全局/前后端规则、3个Agent、6个Skills与实际项目地图，使用方式见 [AI_WORKFLOW.md](./AI_WORKFLOW.md)；配置存在不等于业务已经实现。

已从示例创建本地 `.env` 文件（不提交）；其中数据库密码仍是开发占位值，启动数据库前需自行替换。业务目录只预建了 V1 菜谱、厨房模块和文档目录，没有空业务接口或 V2 文件存储实现。Git 不会记录空目录，后续创建实际文件时才会进入版本控制。
