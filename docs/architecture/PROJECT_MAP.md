# 实际项目目录与文件职责

这是项目的**实际文件地图**，按目录分组列出每个现存文件及职责。更新基线：2026-10-08；以后增删、移动、改名或职责改变时同次维护，不把日期当作完成进度。

[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)是目标规划，不是这份实际清单。地图只记录源码、配置、测试、文档与可提交资源；不展开.git、node_modules、dist、coverage、真实.env、运行数据和空目录。依赖、构建与真实配置用途见第3节。

## 1. 目录总览

```text
sku-cook-ai/
├── .github/
│   ├── copilot-instructions.md
│   ├── instructions/                 前后端范围规则
│   ├── agents/                       Frontend / Backend / Reviewer
│   └── skills/                       开发、评审、Git 与地图工作流
├── apps/
│   ├── web/                          Vue/Vant Web 与组件测试
│   │   ├── public/icons/             PWA 安装图标
│   │   └── src/
│   │       ├── api/                  前端 HTTP Client 与接口函数
│   │       ├── router/               路由表
│   │       ├── styles/               全局样式与主题
│   │       └── views/                目前只有基础首页
│   └── api/                          Fastify 服务与 API 测试
│       ├── prisma/                   模型与 Seed
│       └── src/
│           ├── config/               环境配置与测试
│           ├── plugins/              错误处理与 Prisma 生命周期
│           └── modules/health/       已实现 health 接口
├── packages/shared/src/schemas/      共享 Zod Contract 与测试
└── docs/
    ├── architecture/                 技术栈、目标规划、实际地图
    ├── requirements/                 V1 需求
    ├── design/
    │   ├── screens/                  8 份画面设计与画图提示词
    │   └── apis/                     13 份接口设计
    └── development/                  启动说明与 AI 工作流
```

下面的仓库相对路径表是完整文件级清单；每个文件恰好登记一次，职责不变的小修改不用改条目。

## 2. 完整文件清单

### 2.1 根目录

| 文件 | 职责 |
| --- | --- |
| `.env.example` | Compose数据库配置模板，仅占位值，不含真实密钥。 |
| `.gitignore` | 排除依赖、产物、真实配置、日志、运行数据与本地存储。 |
| `.node-version` | 记录本工程使用的Node.js基线22.18.0。 |
| `.prettierignore` | 定义格式检查排除范围，既有需求/架构文档不自动格式化。 |
| `.prettierrc.json` | 全仓统一Prettier代码格式。 |
| `compose.yaml` | PostgreSQL17本地服务、回环端口、持久Volume与健康检查。 |
| `eslint.config.mjs` | TypeScript/Vue/Node的flat lint配置与产物排除。 |
| `package.json` | workspace总入口、版本约束与统一dev/build/check/test/db脚本。 |
| `pnpm-lock.yaml` | pnpm生成的可提交依赖解析锁，不能手工维护版本树。 |
| `pnpm-workspace.yaml` | workspace包范围及允许执行的必要依赖安装脚本。 |
| `tsconfig.base.json` | 各包共用strict与ES2022等基础TypeScript选项。 |

### 2.2 全局 / 前后端规则与 Agent

| 文件 | 职责 |
| --- | --- |
| `.github/copilot-instructions.md` | 唯一全局规则入口：中文、范围、解耦、验证、地图维护与Git安全。 |
| `.github/instructions/frontend.instructions.md` | apps/web范围的Vue/Vant、表单、请求、PWA、厨房与组件测试约束。 |
| `.github/instructions/backend.instructions.md` | API/shared/Compose范围的Contract、默认用户、事务、迁移与错误约束。 |
| `.github/agents/frontend.agent.md` | Frontend角色、阅读顺序、工具权限、前端职责和交付格式。 |
| `.github/agents/backend.agent.md` | Backend角色、API/shared/数据库职责、跨包验证与交付格式。 |
| `.github/agents/reviewer.agent.md` | Reviewer只读角色，仅read/search，证据评审而不编辑或运行终端。 |

### 2.3 Skills 与维护工具

| 文件 | 职责 |
| --- | --- |
| `.github/skills/git-publish/SKILL.md` | 显式提交/上传时的范围检查、精确暂存、中文commit与非强制push流程。 |
| `.github/skills/implement-screen/SKILL.md` | 按Sxx设计书实现画面、API对接、所有状态与前端验证。 |
| `.github/skills/implement-api/SKILL.md` | 按Axx设计书实现shared/API/事务与跨包测试。 |
| `.github/skills/database-migration/SKILL.md` | 数据库模型、版本化迁移、Seed、安全目标确认与真实验收。 |
| `.github/skills/review-changes/SKILL.md` | RV只读流程、问题证据、设计模式成本与评审报告。 |
| `.github/skills/maintain-project-map/SKILL.md` | 维护实际文件清单的步骤、排除范围与地图检查入口。 |
| `.github/skills/maintain-project-map/scripts/check-map.mjs` | 只读比对实际git可见文件与地图，检查漏项、陈旧、重复和空职责。 |
| `.github/skills/maintain-project-map/scripts/check-map.test.mjs` | Node内置测试验证地图覆盖诊断、路径校验与真实配置排除。 |

### 2.4 Web 工程配置与资源

| 文件 | 职责 |
| --- | --- |
| `apps/web/.env.example` | Web公开API前缀与仅开发服务器使用的代理目标示例。 |
| `apps/web/package.json` | Vue/Vant/Axios等Web依赖及dev/build/preview/typecheck/test脚本。 |
| `apps/web/index.html` | 中文HTML宿主、viewport、PWA主题色与应用挂载节点。 |
| `apps/web/tsconfig.json` | 汇总浏览器应用与Node工具配置的TypeScript引用。 |
| `apps/web/tsconfig.app.json` | Vue/浏览器源码与DOM/PWA类型检查范围。 |
| `apps/web/tsconfig.node.json` | Vite/Vitest工具配置的Node类型检查范围。 |
| `apps/web/vite.config.ts` | Vue编译、开发代理、Manifest、PWA静态预缓存和构建配置。 |
| `apps/web/vitest.config.ts` | Vue插件、jsdom和组件测试文件匹配。 |
| `apps/web/public/icons/pwa-192x192.png` | PWA安装所需192px图标，不是菜谱图片。 |
| `apps/web/public/icons/pwa-512x512.png` | PWA安装所需512px图标。 |
| `apps/web/public/icons/pwa-maskable-512x512.png` | PWA maskable安装图标与安全区资源。 |

### 2.5 Web 源码与测试

| 文件 | 职责 |
| --- | --- |
| `apps/web/src/main.ts` | 创建Vue应用、注册Pinia/Router、加载样式并挂载。 |
| `apps/web/src/App.vue` | 路由出口与PWA新版本刷新提示。 |
| `apps/web/src/vite-env.d.ts` | Vite和PWA虚拟模块的类型声明。 |
| `apps/web/src/api/client.ts` | Axios统一baseURL与超时配置。 |
| `apps/web/src/api/health.ts` | 请求health并用shared Schema校验响应。 |
| `apps/web/src/router/index.ts` | 当前基础首页的路由表；业务路径尚未接入。 |
| `apps/web/src/styles/main.css` | 全局字体、底色、基础首页布局与更新提示样式。 |
| `apps/web/src/styles/vant-theme.css` | 陶土橙主题及Vant文字/背景/边框变量。 |
| `apps/web/src/views/HomeView.vue` | 基础首页、后端联通检查与可读失败状态。 |
| `apps/web/src/views/HomeView.test.ts` | 验证health联通成功、失败提示与允许重试。 |

### 2.6 API 配置、Prisma 与源码

| 文件 | 职责 |
| --- | --- |
| `apps/api/.env.example` | 数据库URL占位、监听地址、日志级别与默认用户配置模板。 |
| `apps/api/package.json` | Fastify/Prisma/shared依赖及开发、生产、验证和db脚本。 |
| `apps/api/tsconfig.json` | API正式源码编译、NodeNext模块解析与dist输出。 |
| `apps/api/tsconfig.check.json` | 把测试、Seed和工具配置一起纳入类型检查。 |
| `apps/api/vitest.config.ts` | Node测试环境及API源码/集成测试匹配。 |
| `apps/api/prisma.config.ts` | Prisma6的schema、迁移目录和Seed命令配置。 |
| `apps/api/prisma/schema.prisma` | PostgreSQL数据源、Client生成器与当前User模型。 |
| `apps/api/prisma/seed.ts` | 幂等upsert默认用户并负责错误报告和断开连接。 |
| `apps/api/src/app.ts` | 构造Fastify实例，装配错误处理、Prisma和health路由。 |
| `apps/api/src/server.ts` | 环境读取、监听启动、启动失败处理与信号退出。 |
| `apps/api/src/config/env.ts` | Zod校验数据库、端口、监听、日志和默认用户环境值。 |
| `apps/api/src/config/env.test.ts` | 验证配置必填、非法URL/端口与默认值。 |
| `apps/api/src/plugins/error-handler.ts` | 基础校验/HTTP/内部异常映射、日志与404响应。 |
| `apps/api/src/plugins/prisma.ts` | Prisma Client注入与Fastify关闭时disconnect。 |
| `apps/api/src/modules/health/health.route.ts` | 无数据库查询的GET /api/health存活接口。 |
| `apps/api/src/modules/health/health.test.ts` | Supertest验证health Contract、404与500不泄漏内部信息。 |

### 2.7 Shared

| 文件 | 职责 |
| --- | --- |
| `packages/shared/package.json` | Zod共享包依赖、编译/测试脚本与显式dist导出。 |
| `packages/shared/tsconfig.json` | 共享源码编译、声明输出与测试文件编译排除。 |
| `packages/shared/src/index.ts` | Health Schema与推导类型的公开出口。 |
| `packages/shared/src/schemas/health.ts` | health运行时Zod响应Contract及HealthResponse类型。 |
| `packages/shared/src/schemas/health.test.ts` | 验证合法health解析与非法状态拒绝。 |

### 2.8 架构、需求与开发文档

| 文件 | 职责 |
| --- | --- |
| `docs/architecture/PROJECT_MAP.md` | 本实际文件清单和职责说明，增删移动/职责变化同次维护。 |
| `docs/architecture/PROJECT_STRUCTURE.md` | 完整目标目录规划与各层职责，不代表所有规划已实现。 |
| `docs/architecture/TECH_STACK.md` | 技术栈、开发边界、默认用户、部署与平板设备方案。 |
| `docs/requirements/REQUIREMENTS_V1.md` | V1纯文字菜谱、厨房/管理功能范围与验收要求。 |
| `docs/development/SETUP.md` | 环境配置、启动/验证命令与基础工程未验收事项。 |
| `docs/development/AI_WORKFLOW.md` | Instructions、Agents、Skills的加载、选择、交接与地图维护方式。 |

### 2.9 共通设计与画面设计

| 文件 | 职责 |
| --- | --- |
| `docs/design/README.md` | 画面/API设计索引、对应关系与尚待确认的设计取舍。 |
| `docs/design/COMMON.md` | 业务设计稿的视觉、数据、错误、厨房版本和事务约定。 |
| `docs/design/screens/S00_HOME.md` | 基础过渡首页的设计、现有联通状态与画图提示词。 |
| `docs/design/screens/S01_RECIPE_LIST.md` | 列表/搜索/标签/触底加载/多选设计与画图提示词。 |
| `docs/design/screens/S02_RECIPE_DETAIL.md` | 详情、食材分组、步骤、删除/发送入口与画图提示词。 |
| `docs/design/screens/S03_RECIPE_CREATE.md` | 新增表单、动态食材/步骤、校验与画图提示词。 |
| `docs/design/screens/S04_RECIPE_EDIT.md` | 编辑回填、完整替换、离开提醒与画图提示词。 |
| `docs/design/screens/S05_RECIPE_IMPORT.md` | JSON输入、预校验/正式导入、错误报告与画图提示词。 |
| `docs/design/screens/S06_KITCHEN_DISPLAY.md` | 厨房多状态/按钮分页/轮询/常亮/断网设计与各状态画图提示词。 |
| `docs/design/screens/S07_KITCHEN_PANEL.md` | 手机发送/查看/替换/清空厨房菜单弹层设计与画图提示词。 |

### 2.10 逐接口设计

| 文件 | 职责 |
| --- | --- |
| `docs/design/apis/A01_HEALTH_GET.md` | 已有health接口的输入、响应与存活非数据库验收边界。 |
| `docs/design/apis/A02_RECIPES_GET.md` | 菜谱分页搜索/筛选与摘要响应设计。 |
| `docs/design/apis/A03_RECIPE_TAGS_GET.md` | 默认用户全部标签汇总设计。 |
| `docs/design/apis/A04_RECIPE_GET.md` | 详情读取、完整DTO与不存在/归属检查设计。 |
| `docs/design/apis/A05_RECIPE_POST.md` | 新增输入、默认用户、同名约束与事务设计。 |
| `docs/design/apis/A06_RECIPE_PUT.md` | 全量编辑、可选字段清除及厨房版本联动设计。 |
| `docs/design/apis/A07_RECIPE_DELETE.md` | 删除菜谱/从属数据与厨房菜单移除事务设计。 |
| `docs/design/apis/A08_IMPORT_VALIDATE_POST.md` | 导入只读预校验、字段定位与同名报告设计。 |
| `docs/design/apis/A09_IMPORT_POST.md` | 正式导入重新校验、整批回滚与结果不确定设计。 |
| `docs/design/apis/A10_KITCHEN_GET.md` | 厨房完整快照、空菜单、版本与轮询间隔设计。 |
| `docs/design/apis/A11_KITCHEN_PUT.md` | 发送/替换有序菜单与旧版本保护设计。 |
| `docs/design/apis/A12_KITCHEN_ACTIVE_PATCH.md` | 切换当前菜、成员检查与冲突处理设计。 |
| `docs/design/apis/A13_KITCHEN_DELETE.md` | 完成/清空会话、保留版本与不删除菜谱设计。 |

## 3. 不展开的目录与运行文件

- node_modules与Prisma Client：由pnpm/Prisma生成，不提交；lockfile必须维护。
- dist：Web静态产物、API编译JavaScript、shared JavaScript/声明与Service Worker，不作为实际源码逐项登记。
- 真实.env：根用于Compose、API用于服务/Prisma、Web用于Vite；不读取或记录值。只登记.env.example。
- PostgreSQL Volume与未来storage：运行数据，不提交；V1未实现菜谱图片存储。
- 空业务目录即使本地预建，Git不会保存，不表示有实现文件。
- README.md与README_personal_daily_app_memo.md已有删除状态，未恢复，不列作现存入口。

## 4. 当前边界与维护

已实现基础首页、health、shared健康Contract、User模型/Seed源码、工程工具与PWA基础；菜谱/厨房业务、业务Schema、迁移与真机行为仍须按设计逐步实施。此前数据库迁移、Seed实际运行、HTTPS/PWA和Wake Lock实测记录以SETUP及后续验收更新为准，不凭文件存在断言验证完成。

本次新增Instructions、6个Skills、3个Agents和只读地图检查工具。没有AGENTS.md，避免双份全局规则漂移；角色工具权限与操作流程见 [AI_WORKFLOW.md](../development/AI_WORKFLOW.md)。

维护时使用maintain-project-map Skill；结构变更后执行：

```powershell
node .github\skills\maintain-project-map\scripts\check-map.mjs
```

检查通过只保证路径覆盖，不保证描述语义准确。职责、入口、重要依赖变化要主动更新对应条目；新增/移动设计书同步设计索引，目录策略变化同步目标规划。
