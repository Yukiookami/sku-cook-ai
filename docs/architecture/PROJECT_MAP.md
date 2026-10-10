# 吃什么饭 · 实际项目目录与文件职责

这是项目的**实际文件地图**，按目录分组列出每个现存文件及职责。更新基线：2026-10-10；以后增删、移动、改名或职责改变时同次维护，不把日期当作完成进度。

[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)是目标规划，不是这份实际清单。地图只记录源码、配置、测试、文档与可提交资源；不展开.git、node_modules、dist、coverage、真实.env、运行数据和空目录。依赖、构建与真实配置用途见第3节。

产品名称为“吃什么饭”；仓库和包名保持原工程标识。设计图生成/修改的唯一提示词入口是[提示词文件](../design/screens/images/PROMPTS.md)，按S00–S08查找当前Memo规范、主提示词及补充状态；画面设计书负责交互、字段与验收，不存提示词副本。后续视觉提示更新集中在该文件，业务变更仍同步相关设计；生成新图同时维护图集索引、实际生成记录与本地图，详见[AI工作流](../development/AI_WORKFLOW.md#7-设计图提示词与版本维护)。S00技术验证页保留在`/health-check`（非正式产品首页），`/`现导向菜谱一览。S01–S08 Web界面已实现并按V3 Memo图稿还原；API client已按shared Contract接入，A02–A19源码已实现。初始迁移已应用于本地Docker开发数据库，Seed连续两次运行保持一个默认用户；A01、A02、A10、A16已通过真实HTTP只读冒烟检查，但写入事务及完整数据库集成仍待验收。浏览器图稿对照与Android真机验收亦待执行。新版Memo已有9张主图及2张补充图，旧V1/V2 PNG已按用户要求删除，历史输入记录保留。

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
│   │       ├── api/                  HTTP Client、health及业务接口消费函数
│   │       ├── components/           共用、菜谱及厨房业务组件
│   │       │   ├── common/           跨业务复用组件
│   │       │   ├── recipes/          菜谱表单及子组件
│   │       │   └── kitchen/          厨房菜单弹层
│   │       ├── composables/          厨房屏Wake Lock生命周期
│   │       ├── domain/               菜谱草稿映射与业务纯函数
│   │       ├── router/               正式入口及S00–S08路由
│   │       ├── styles/               全局奶油黄Memo样式与Vant主题
│   │       └── views/                按业务分类的S00–S08页面
│   │           ├── system/           技术联通检查
│   │           ├── recipes/          菜谱页面
│   │           ├── kitchen/          厨房显示
│   │           └── history/          做饭历史
│   └── api/                          Fastify 服务与 API 测试
│       ├── prisma/                   模型与 Seed
│       └── src/
│           ├── config/               环境配置与测试
│           ├── plugins/              错误处理与 Prisma 生命周期
│           ├── modules/health/       health 接口
│           ├── modules/recipes/      菜谱CRUD、标签、随机与导入路由/服务
│           ├── modules/kitchen/      厨房会话原子写入与快照
│           └── modules/history/      做饭历史读写与删除
├── packages/shared/src/              共享 Zod Contract、换算函数与测试
└── docs/
    ├── architecture/                 技术栈、目标规划、实际地图
    ├── requirements/                 V1 需求
    ├── design/
    │   ├── screens/                  9份画面设计及独立提示词/参考图
    │   └── apis/                     18份接口设计
    └── development/                  启动说明与 AI 工作流
```

下面的仓库相对路径表是完整文件级清单；每个文件恰好登记一次，职责不变的小修改不用改条目。

## 2. 完整文件清单

### 2.1 根目录

| 文件                  | 职责                                                         |
| --------------------- | ------------------------------------------------------------ |
| `.env.example`        | Compose数据库配置模板，仅占位值，不含真实密钥。              |
| `.gitignore`          | 排除依赖、产物、真实配置、日志、运行数据与本地存储。         |
| `.node-version`       | 记录本工程使用的Node.js基线24.20.0。                         |
| `.prettierignore`     | 定义格式检查排除范围，既有需求/架构文档不自动格式化。        |
| `.prettierrc.json`    | 全仓统一Prettier代码格式。                                   |
| `compose.yaml`        | PostgreSQL17本地服务、回环端口、持久Volume与健康检查。       |
| `eslint.config.mjs`   | TypeScript/Vue/Node的flat lint配置与产物排除。               |
| `package.json`        | workspace总入口、版本约束与统一dev/build/check/test/db脚本。 |
| `pnpm-lock.yaml`      | pnpm生成的可提交依赖解析锁，不能手工维护版本树。             |
| `pnpm-workspace.yaml` | workspace包范围及允许执行的必要依赖安装脚本。                |
| `tsconfig.base.json`  | 各包共用strict与ES2022等基础TypeScript选项。                 |

### 2.2 全局 / 前后端规则与 Agent

| 文件                                            | 职责                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `.github/copilot-instructions.md`               | 唯一全局规则入口：中文、范围、解耦、验证、地图维护与Git安全。      |
| `.github/instructions/frontend.instructions.md` | apps/web范围的Vue/Vant、表单、请求、PWA、厨房与组件测试约束。      |
| `.github/instructions/backend.instructions.md`  | API/shared/Compose范围的Contract、默认用户、事务、迁移与错误约束。 |
| `.github/agents/frontend.agent.md`              | Frontend角色、阅读顺序、工具权限、前端职责和交付格式。             |
| `.github/agents/backend.agent.md`               | Backend角色、API/shared/数据库职责、跨包验证与交付格式。           |
| `.github/agents/reviewer.agent.md`              | Reviewer只读角色，仅read/search，证据评审而不编辑或运行终端。      |

### 2.3 Skills 与维护工具

| 文件                                                             | 职责                                                                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `.github/skills/git-publish/SKILL.md`                            | 显式提交/上传时的范围检查、精确暂存、中文commit与非强制push流程。                                        |
| `.github/skills/implement-screen/SKILL.md`                       | 按Sxx设计及独立提示词实现画面/API/状态，要求低成本设计图还原、截图对照修正与差异交付，高成本精修先确认。 |
| `.github/skills/implement-api/SKILL.md`                          | 按Axx设计书实现shared/API/事务与跨包测试。                                                               |
| `.github/skills/database-migration/SKILL.md`                     | 数据库模型、版本化迁移、Seed、安全目标确认与真实验收。                                                   |
| `.github/skills/review-changes/SKILL.md`                         | RV只读流程、问题证据、设计模式成本与评审报告。                                                           |
| `.github/skills/maintain-project-map/SKILL.md`                   | 维护实际文件清单的步骤、排除范围与地图检查入口。                                                         |
| `.github/skills/maintain-project-map/scripts/check-map.mjs`      | 只读比对实际git可见文件与地图，检查漏项、陈旧、重复和空职责。                                            |
| `.github/skills/maintain-project-map/scripts/check-map.test.mjs` | Node内置测试验证地图覆盖诊断、路径校验与真实配置排除。                                                   |

### 2.4 Web 工程配置与资源

| 文件                                             | 职责                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `apps/web/.env.example`                          | Web公开API前缀与仅开发服务器使用的代理目标示例。                           |
| `apps/web/package.json`                          | Vue/Vant/Axios等Web依赖及dev/build/preview/typecheck/test脚本。            |
| `apps/web/public/icons/app-icon-192-v1.png` | 饭碗与问号品牌图标；对应尺寸与平台用途见品牌说明。 |
| `apps/web/public/icons/app-icon-512-v1.png` | 饭碗与问号品牌图标；对应尺寸与平台用途见品牌说明。 |
| `apps/web/public/icons/app-icon-maskable-512-v1.png` | 饭碗与问号品牌图标；对应尺寸与平台用途见品牌说明。 |
| `apps/web/public/icons/apple-touch-icon-180-v1.png` | 饭碗与问号品牌图标；对应尺寸与平台用途见品牌说明。 |
| `apps/web/public/icons/favicon-32-v1.png` | 饭碗与问号品牌图标；对应尺寸与平台用途见品牌说明。 |
| `docs/design/brand/app-logo-v1.png` | 抽象饭碗与问号品牌原图，已用于安装图标。 |
| `docs/design/brand/README.md` | 品牌资源用途、提示词入口与图标更新说明。 |
| `apps/web/index.html`                            | “吃什么饭”HTML宿主、viewport安全区、PWA主题色、iOS独立模式与应用挂载节点。  |
| `apps/web/tsconfig.json`                         | 汇总浏览器应用与Node工具配置的TypeScript引用。                             |
| `apps/web/tsconfig.app.json`                     | Vue/浏览器源码与DOM/PWA类型检查范围。                                      |
| `apps/web/tsconfig.node.json`                    | Vite/Vitest工具配置的Node类型检查范围。                                    |
| `apps/web/vite.config.ts`                        | Vue编译、开发代理、Tailscale白名单、开发/生产共用的全站安装Manifest与PWA构建；开发不注册Service Worker。 |
| `apps/web/vitest.config.ts`                      | Vue插件、jsdom和组件测试文件匹配。                                         |

### 2.5 Web 源码与测试

| 文件                                  | 职责                                                         |
| ------------------------------------- | ------------------------------------------------------------ |
| `apps/web/src/main.ts`                | 创建Vue应用、注册Pinia/Router、加载样式并挂载。              |
| `apps/web/src/App.vue`                | 路由出口与PWA新版本刷新提示。                                |
| `apps/web/src/vite-env.d.ts`          | Vite和PWA虚拟模块的类型声明。                                |
| `apps/web/src/api/client.ts`                    | Axios统一baseURL与超时配置。                                                 |
| `apps/web/src/api/health.ts`                    | 请求health并用shared Schema校验响应。                                        |
| `apps/web/src/api/recipes.ts`                   | A02–A09、A14、A19菜谱接口 typed client；请求与响应由shared Schema校验。        |
| `apps/web/src/api/kitchen.ts`                   | A10–A13、A15厨房接口 typed client；携带会话revision。                         |
| `apps/web/src/api/cooking-history.ts`           | A16–A18做饭历史接口 typed client。                                            |
| `apps/web/src/api/errors.ts`                    | 将网络与HTTP状态转换为可读提示，并从shared错误Contract提取导入问题。          |
| `apps/web/src/api/clients.test.ts`              | 使用Contract合法响应和测试HTTP Adapter验证业务API路径/请求体/响应层级/204。 |
| `apps/web/src/components/common/PageHeader.vue` | 业务子页统一返回、标题与右侧操作。                                            |
| `apps/web/src/components/recipes/RecipeForm.vue` | 新增/编辑表单协调：草稿、shared校验、标签读取、提交与子组件组合。             |
| `apps/web/src/components/recipes/AutocompleteInput.vue` | 菜谱表单联想输入、焦点/键盘选择和显式边界内的弹层布局。                  |
| `apps/web/src/components/recipes/AutocompleteInput.test.ts` | 验证输入/选择事件、IME、关闭、弹层边界与键盘滚动。                          |
| `apps/web/src/components/recipes/RecipeBasicFields.vue` | 基本信息字段展示，通过不可变更新事件传递修改。                          |
| `apps/web/src/components/recipes/RecipeTagPicker.vue` | 标签筛选、选取、自由添加与移除；不自行请求API。                             |
| `apps/web/src/components/recipes/IngredientEditor.vue` | 单条食材编辑、组合用量、快捷项与高级选项；仅接收字段级错误。               |
| `apps/web/src/components/recipes/RecipeStepsEditor.vue` | 步骤编辑、添加/删除/重排；通过数组更新事件传递修改。                       |
| `apps/web/src/components/recipes/RecipeForm.test.ts` | 验证shared字段限制、提交后实时校验、必填提示及数量/单位组合联想。            |
| `apps/web/src/components/kitchen/KitchenMenuPanel.vue` | S07查看/发送/清空弹层、目标份数、冲突刷新及A11成功确认弹窗。                |
| `apps/web/src/components/kitchen/KitchenMenuPanel.test.ts` | 验证开弹层读取、独立份数调整、A11成功确认操作及冲突不误报成功。           |
| `apps/web/src/views/kitchen/KitchenDisplayView.test.ts` | 验证A15完成、整菜连续滚动、返回滚动恢复及常亮提醒收起状态。                 |
| `apps/web/src/composables/useWakeLock.ts`        | 厨房页可见状态下申请/释放Screen Wake Lock及安全降级。                         |
| `apps/web/src/composables/useWakeLock.test.ts`  | 验证迟到的Wake Lock sentinel在菜单清空或组件卸载后释放。                     |
| `apps/web/src/domain/recipe-form.ts` | 菜谱草稿类型、回填、数量单位解析、shared校验映射与错误字段定位的纯函数。      |
| `apps/web/src/domain/recipe-form.test.ts` | 验证编辑回填保留原数量/单位边界、可选数字与自定义/范围用量解析。              |
| `apps/web/src/router/index.ts`                   | `/`正式重定向菜谱，注册S00–S08及未知路径。                                    |
| `apps/web/src/styles/main.css`                   | 奶油黄Memo主题、响应式页面、厨房横竖屏、发送成功弹窗与安全区布局。            |
| `apps/web/src/styles/vant-theme.css`              | 奶油黄Memo色彩与Vant文字/背景/边框变量。                                      |
| `apps/web/src/views/system/HomeView.vue` | S00技术联通检查页；不验证数据库，不是正式业务首页。                            |
| `apps/web/src/views/system/HomeView.test.ts` | 验证health初始、成功、失败提示与重试。                                         |
| `apps/web/src/views/recipes/RecipeListView.vue` | S01列表、搜索/tag过滤、分页、随机推荐、多选与导航。                          |
| `apps/web/src/views/recipes/RecipeListView.test.ts` | 验证选择上限、分页并发、初次加载错误与发送后回到菜谱一览。                  |
| `apps/web/src/views/recipes/RecipeImportView.test.ts` | 验证A08/A09导入流程、A19下载状态及文件选择/模式切换竞态。                  |
| `apps/web/src/views/recipes/RecipeDetailView.vue` | S02详情、份数参考换算、编辑/删除/手动历史入口及单菜发送。                   |
| `apps/web/src/views/recipes/RecipeDetailView.test.ts` | 验证发送到厨房成功后留在详情或返回菜谱一览。                              |
| `apps/web/src/views/recipes/RecipeCreateView.vue` | S03新增页，使用共用表单并保留失败草稿。                                      |
| `apps/web/src/views/recipes/RecipeCreateView.test.ts` | 验证新增保存成功后跳转不会误触发未保存提醒。                               |
| `apps/web/src/views/recipes/RecipeEditView.vue` | S04读取、回填并完整替换菜谱，复用新增表单。                                 |
| `apps/web/src/views/recipes/RecipeEditView.test.ts` | 验证菜谱ID切换后逆序返回的旧GET不会覆盖当前编辑数据。                      |
| `apps/web/src/views/recipes/RecipeImportView.vue` | S05 菜谱JSON导入/导出、文件/粘贴、预校验与完整菜库备份。                |
| `apps/web/src/views/kitchen/KitchenDisplayView.vue` | S06厨房轮询、版本写入、整菜滚动/切换、完成历史及Wake Lock。                |
| `apps/web/src/views/history/CookingHistoryView.test.ts` | 验证历史初次读取失败后可重试并恢复空列表状态。                         |
| `apps/web/src/views/history/CookingHistoryView.vue` | S08历史分页、最新菜谱打开与删除误记。                                      |

### 2.6 API 配置、Prisma 与源码

| 文件                                          | 职责                                                   |
| --------------------------------------------- | ------------------------------------------------------ |
| `apps/api/.env.example`                       | 数据库URL占位、监听地址、日志级别与默认用户配置模板。  |
| `apps/api/package.json`                       | Fastify/Prisma/shared依赖及开发、生产、验证和db脚本。  |
| `apps/api/tsconfig.json`                      | API正式源码编译、NodeNext模块解析与dist输出。          |
| `apps/api/tsconfig.check.json`                | 把测试、Seed和工具配置一起纳入类型检查。               |
| `apps/api/vitest.config.ts`                   | Node测试环境及API源码/集成测试匹配。                   |
| `apps/api/prisma.config.ts`                   | Prisma6的schema、迁移目录和Seed命令配置。              |
| `apps/api/prisma/migrations/20261008132653_initial_recipe_schema/migration.sql` | 首次创建用户、菜谱、厨房会话与做饭历史数据表、外键和索引；已应用于本地开发数据库。 |
| `apps/api/prisma/migrations/migration_lock.toml` | 固定Prisma迁移provider为PostgreSQL。                |
| `apps/api/prisma/schema.prisma`               | PostgreSQL数据源、保留User并定义菜谱、厨房及历史模型/外键/唯一索引；本地初始迁移已应用，其他环境未应用。 |
| `apps/api/prisma/seed.ts`                     | 幂等upsert默认用户并负责错误报告和断开连接。           |
| `apps/api/src/app.ts`                         | 构造Fastify实例，装配统一错误处理、Prisma、no-store及health/业务路由。 |
| `apps/api/src/server.ts`                      | 环境读取（默认用户/轮询间隔）、监听启动、失败处理与退出。 |
| `apps/api/src/config/env.ts`                  | Zod校验数据库、端口、监听、日志、默认用户和厨房轮询间隔。 |
| `apps/api/src/config/env.test.ts`             | 验证配置必填、非法URL/端口与默认值。                   |
| `apps/api/src/plugins/error-handler.ts`       | 基础校验/HTTP/内部异常映射、日志与404响应。            |
| `apps/api/src/plugins/prisma.ts`              | Prisma Client注入与Fastify关闭时disconnect。           |
| `apps/api/src/modules/common/errors.ts`       | 统一业务错误、Zod issue格式化及可识别数据库/唯一键错误分类。 |
| `apps/api/src/modules/health/health.route.ts` | 无数据库查询的GET /api/health存活接口。                |
| `apps/api/src/modules/health/health.test.ts`  | Supertest验证health Contract、404与500不泄漏内部信息。 |
| `apps/api/src/modules/recipes/recipe.route.ts` | A02–A09/A14/A19路由、菜谱导入事务、完整导出与响应Contract。 |
| `apps/api/src/modules/recipes/recipe.service.ts` | 菜谱DTO/导出输入转换、summary、归一化输入、用户锁与菜谱写入公共业务。 |
| `apps/api/src/modules/recipes/recipe.route.test.ts` | 不连接数据库的路由参数/未知字段/错误envelope边界测试。 |
| `apps/api/src/modules/recipes/recipe.service.test.ts` | 测试随机候选索引边界与菜谱导出DTO，不模拟数据库业务集成。 |
| `apps/api/src/modules/kitchen/kitchen.route.ts` | A10–A13/A15厨房快照、revision写入、完成记历史并清空。 |
| `apps/api/src/modules/kitchen/kitchen.service.ts` | 厨房状态DTO/一致性校验及默认用户事务锁。 |
| `apps/api/src/modules/history/history.route.ts` | A16–A18历史分页、手动记录与整次删除。 |
| `apps/api/src/modules/history/history.service.ts` | 历史DTO与持久化不变量校验。 |

### 2.7 Shared

| 文件                                         | 职责                                              |
| -------------------------------------------- | ------------------------------------------------- |
| `packages/shared/package.json`               | Zod共享包依赖、编译/测试脚本与显式dist导出。      |
| `packages/shared/tsconfig.json`              | 共享源码编译、声明输出与测试文件编译排除。        |
| `packages/shared/src/index.ts`               | Health及菜谱、厨房、历史Contract和份数函数公开出口。 |
| `packages/shared/src/schemas/health.ts`      | health运行时Zod响应Contract及HealthResponse类型。 |
| `packages/shared/src/schemas/health.test.ts` | 验证合法health解析与非法状态拒绝。                |
| `packages/shared/src/schemas/recipe.ts`      | 菜谱输入/响应、摘要、查询、随机、JSON导入/导出Schema与限制常量。 |
| `packages/shared/src/schemas/recipe.test.ts` | 验证菜谱字段默认/边界、严格未知字段、分页、厨房及迁移导入/导出约束。 |
| `packages/shared/src/schemas/kitchen.ts`     | 厨房会话/菜单/切换/版本请求Contract与DTO类型。 |
| `packages/shared/src/schemas/history.ts`     | 做饭历史及分页/手动写入/参数Contract与DTO类型。 |
| `packages/shared/src/domain/servings.ts`     | 精确十进制份数换算和菜谱总分钟纯函数。 |
| `packages/shared/src/domain/servings.test.ts` | 验证精确换算、舍入、原文保留及小于0.01显示。 |

### 2.8 架构、需求与开发文档

| 文件                                     | 职责                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `docs/architecture/PROJECT_MAP.md`       | 本实际文件清单和职责说明，增删移动/职责变化同次维护。                               |
| `docs/architecture/PROJECT_STRUCTURE.md` | 完整目标目录规划与各层职责，不代表所有规划已实现。                                  |
| `docs/architecture/TECH_STACK.md`        | 技术栈、开发边界、默认用户、部署与平板设备方案。                                    |
| `docs/requirements/REQUIREMENTS_V1.md`   | V1纯文字菜谱、随机推荐、厨房/管理范围与验收，以及V2随机外卖分享链接需求和待定细节。 |
| `docs/development/SETUP.md`              | 本地环境配置、数据库首次初始化、日常启动/停止命令与常见问题。                       |
| `docs/development/AI_WORKFLOW.md`        | Instructions、Agents、Skills的加载、选择、交接、地图及设计图提示词/版本维护方式。   |

### 2.9 共通设计与画面设计

| 文件                                         | 职责                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `docs/design/README.md`                      | 画面/API设计索引、对应关系、视觉参考图入口与尚待确认的设计取舍。              |
| `docs/design/COMMON.md`                      | 业务设计稿的视觉、数据、错误、厨房版本和事务约定。                            |
| `docs/design/screens/S00_HOME.md`            | 基础过渡首页的设计、现有联通状态、验收与独立提示词链接。                      |
| `docs/design/screens/S01_RECIPE_LIST.md`     | 列表/搜索/标签/触底加载/多选及随机推荐区/换一个设计、验收与独立提示词链接。   |
| `docs/design/screens/S02_RECIPE_DETAIL.md`   | 详情/份数换算、删除/发送、手动记录做过及历史目标初始化设计与验收。            |
| `docs/design/screens/S03_RECIPE_CREATE.md`   | 新增表单、动态食材/步骤、校验、验收与独立提示词链接。                         |
| `docs/design/screens/S04_RECIPE_EDIT.md`     | 编辑回填、完整替换、离开提醒、验收与独立提示词链接。                          |
| `docs/design/screens/S05_RECIPE_IMPORT.md`   | 菜谱JSON导入/导出、预校验、错误报告、验收与独立提示词链接。                   |
| `docs/design/screens/S06_KITCHEN_DISPLAY.md` | 厨房多状态/整菜滚动/切换/轮询/常亮/断网设计、验收与独立提示词链接。            |
| `docs/design/screens/S07_KITCHEN_PANEL.md`   | 手机发送/查看/替换/清空厨房菜单弹层设计、验收与独立提示词链接。               |
| `docs/design/screens/S08_COOKING_HISTORY.md` | 历史分组/触底分页、最新做法与目标份数、已删菜保留及整次误记删除设计；Web已实现，数据库验收待做。 |

### 2.9.1 画面设计图、唯一提示词入口与生成记录

| 文件                                                    | 职责                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `docs/design/screens/images/README.md`                  | 当前11张Memo V3图索引、长内容延伸/平板布局、旧图清理说明与视觉验收边界。 |
| `docs/design/screens/images/PROMPTS.md`                 | 唯一提示词入口：当前Memo/页面延伸规范、S00–S08主提示词/补充状态、V3真实输入与V1/V2历史记录。 |

### 2.9.2 当前 Memo V3 主图与补充图

| 文件 | 职责 |
| --- | --- |
| `docs/design/screens/images/S00_HOME-v3.png` | “吃什么饭”技术验证页的Memo V3静态视觉参考，不代表功能已实现。 |
| `docs/design/screens/images/S01_RECIPE_LIST-v3.png` | “吃什么饭”菜谱一览与随机推荐的Memo V3静态视觉参考，不代表功能已实现。 |
| `docs/design/screens/images/S02_RECIPE_DETAIL-v3.png` | “吃什么饭”菜谱详情与目标份数的Memo V3静态视觉参考，不代表功能已实现。 |
| `docs/design/screens/images/S03_RECIPE_CREATE-v3.png` | “吃什么饭”新增菜谱宽松首屏的Memo V3静态视觉参考，不代表功能已实现。 |
| `docs/design/screens/images/S04_RECIPE_EDIT-v3.png` | “吃什么饭”编辑菜谱宽松首屏的Memo V3静态视觉参考，不代表功能已实现。 |
| `docs/design/screens/images/S05_RECIPE_IMPORT-v3.png` | “吃什么饭”JSON批量导入的Memo V3静态视觉参考，不代表功能已实现。 |
| `docs/design/screens/images/S06_KITCHEN_DISPLAY-v3.png` | “吃什么饭”Android厨房竖屏步骤页的Memo V3静态视觉参考，不代表功能已实现。 |
| `docs/design/screens/images/S07_KITCHEN_PANEL-v3.png` | “吃什么饭”发送到厨房弹层的Memo V3静态视觉参考，不代表功能已实现。 |
| `docs/design/screens/images/S08_COOKING_HISTORY-v3.png` | “吃什么饭”做饭历史的Memo V3静态视觉参考，不代表功能已实现。 |
| `docs/design/screens/images/S03_RECIPE_FORM_MIDDLE-v3.png` | “吃什么饭”表单中段（食材与步骤）的Memo V3静态视觉参考，不代表功能已实现。 |
| `docs/design/screens/images/S06_KITCHEN_LANDSCAPE-v3.png` | “吃什么饭”厨房横屏两栏的Memo V3静态视觉参考，不代表功能已实现。 |

### 2.10 逐接口设计

| 文件                                             | 职责                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `docs/design/apis/A01_HEALTH_GET.md`             | 已有health接口的输入、响应与存活非数据库验收边界。                                 |
| `docs/design/apis/A02_RECIPES_GET.md`            | 菜谱分页搜索/筛选与摘要响应设计。                                                  |
| `docs/design/apis/A03_RECIPE_TAGS_GET.md`        | 默认用户全部标签汇总设计。                                                         |
| `docs/design/apis/A04_RECIPE_GET.md`             | 详情读取、完整DTO与不存在/归属检查设计。                                           |
| `docs/design/apis/A05_RECIPE_POST.md`            | 新增输入、默认用户、同名约束与事务设计。                                           |
| `docs/design/apis/A06_RECIPE_PUT.md`             | 全量编辑、可选字段清除及厨房版本联动设计。                                         |
| `docs/design/apis/A07_RECIPE_DELETE.md`          | 删除菜谱/从属数据与厨房菜单移除事务设计。                                          |
| `docs/design/apis/A08_IMPORT_VALIDATE_POST.md`   | 导入只读预校验、字段定位与同名报告设计。                                           |
| `docs/design/apis/A09_IMPORT_POST.md`            | 正式导入重新校验、整批回滚与结果不确定设计。                                       |
| `docs/design/apis/A10_KITCHEN_GET.md`            | 厨房完整快照、空菜单、版本与轮询间隔设计。                                         |
| `docs/design/apis/A11_KITCHEN_PUT.md`            | 发送/替换有序菜单与旧版本保护设计。                                                |
| `docs/design/apis/A12_KITCHEN_ACTIVE_PATCH.md`   | 切换当前菜、成员检查与冲突处理设计。                                               |
| `docs/design/apis/A13_KITCHEN_DELETE.md`         | 手机清空厨房、保留版本/菜谱/历史且不生成历史的设计。                               |
| `docs/design/apis/A14_RECIPE_RANDOM_GET.md`      | V1全部已有菜谱随机推荐/排除当前、摘要/无候选响应、用户范围和只读测试设计，待实现。 |
| `docs/design/apis/A15_KITCHEN_COMPLETE_POST.md`  | 厨房完成记录整顿历史与清空同事务、版本及重复提交/结果不明设计，待实现。            |
| `docs/design/apis/A16_COOKING_HISTORY_GET.md`    | 用户历史分页、有序菜名/目标快照和删菜可空引用响应设计，待实现。                    |
| `docs/design/apis/A17_COOKING_HISTORY_POST.md`   | 单菜手动记录、服务端时间/菜名/份数与厨房无副作用设计，待实现。                     |
| `docs/design/apis/A18_COOKING_HISTORY_DELETE.md` | 删除整次误记历史、归属/事务/204及不恢复厨房的设计，待实现。                        |
| `docs/design/apis/A19_RECIPE_EXPORT_GET.md`      | 默认用户完整菜库JSON快照导出、迁移格式、超限失败与验收设计。                      |

## 3. 不展开的目录与运行文件

- node_modules与Prisma Client：由pnpm/Prisma生成，不提交；lockfile必须维护。
- dist：Web静态产物、API编译JavaScript、shared JavaScript/声明与Service Worker，不作为实际源码逐项登记。
- 真实.env：根用于Compose、API用于服务/Prisma、Web用于Vite；不读取或记录值。只登记.env.example。
- PostgreSQL Volume与未来storage：运行数据，不提交；V1未实现菜谱图片存储。
- 空业务目录即使本地预建，Git不会保存，不表示有实现文件。
- README.md与README_personal_daily_app_memo.md已有删除状态，未恢复，不列作现存入口。

## 4. 当前边界与维护

已实现基础首页、health、完整shared业务Contract、A02–A19业务源码、Prisma Schema、默认User模型/Seed源码、工程工具与PWA基础。初始版本化迁移已应用于本地开发数据库；仍需按具体设计书确认业务数据库集成、HTTPS/PWA和Wake Lock实测，不凭源码/Schema存在断言运行时已成功。

本次新增Instructions、6个Skills、3个Agents和只读地图检查工具。没有AGENTS.md，避免双份全局规则漂移；角色工具权限与操作流程见 [AI_WORKFLOW.md](../development/AI_WORKFLOW.md)。

维护时使用maintain-project-map Skill；结构变更后执行：

```powershell
node .github\skills\maintain-project-map\scripts\check-map.mjs
```

检查通过只保证路径覆盖，不保证描述语义准确。职责、入口、重要依赖变化要主动更新对应条目；新增/移动设计书同步设计索引，目录策略变化同步目标规划。
