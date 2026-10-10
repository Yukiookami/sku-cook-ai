# 吃什么饭 · 项目目录规划

## 1. 使用方式

这是完整的目标结构，不代表现在一次创建全部文件。

- 【基础】：初始化阶段分步创建，并验证能够运行。
- 【业务】：实现对应功能时创建。
- 【按需】：出现重复流程或具体问题后创建。
- 【V2】：V1范围之外（如图片/文件存储、随机外卖分享链接），仅记规划，V1不创建。

基础工程已创建：workspace、Web技术联通验证页（非正式产品首页）、API health、共享Contract、Prisma默认用户模型与Seed、检查工具和PWA基础。启动方式见[SETUP.md](../development/SETUP.md)。下列结构仍含未实施的业务/按需项目，不能认为全部已实现；数据库迁移需PostgreSQL就绪后生成。

## 2. 完整目标结构

```text
sku-cook-ai/
├── README.md                              【基础】项目入口与启动说明
├── package.json                           【基础】仓库统一命令
├── pnpm-workspace.yaml                    【基础】workspace 范围
├── pnpm-lock.yaml                         【基础】依赖安装后生成并提交
├── tsconfig.base.json                     【基础】公共 TypeScript 选项
├── .node-version                          【基础】Node.js 24.20.0
├── eslint.config.mjs                      【基础】公共 lint 配置
├── .prettierrc.json                       【基础】格式规则
├── .prettierignore                        【基础】格式检查排除项
├── .gitignore                             【基础】排除依赖、产物、密钥及数据
├── .env.example                           【基础】Compose 配置示例
├── compose.yaml                           【基础】开发 PostgreSQL
│
├── .github/
│   ├── copilot-instructions.md             已创建：唯一全局规则入口
│   ├── instructions/                      已创建：按文件范围生效的前后端规则
│   │   ├── frontend.instructions.md
│   │   └── backend.instructions.md
│   ├── agents/                            已创建：Copilot 职责配置
│   │   ├── frontend.agent.md
│   │   ├── backend.agent.md
│   │   └── reviewer.agent.md
│   ├── skills/                            已创建：6 个按需工作流
│   │   ├── git-publish/SKILL.md            明确请求后提交/推送
│   │   ├── implement-screen/SKILL.md       按画面设计书实施前端
│   │   ├── implement-api/SKILL.md          按接口设计书实施后端
│   │   ├── database-migration/SKILL.md     模型、迁移与 Seed 安全流程
│   │   ├── review-changes/SKILL.md         只读 RV 评审
│   │   └── maintain-project-map/
│   │       ├── SKILL.md                   实际项目地图维护
│   │       └── scripts/
│   │           ├── check-map.mjs          只读清单覆盖检查
│   │           └── check-map.test.mjs     Node 内置测试
│   └── workflows/
│       └── ci.yml                         【按需】本地检查稳定后接入 CI
│
├── apps/
│   ├── web/
│   │   ├── package.json                   【基础】Web 依赖与命令
│   │   ├── index.html                     【基础】HTML 入口
│   │   ├── vite.config.ts                 【基础】Vue、代理、PWA 与构建
│   │   ├── vitest.config.ts               【基础】组件测试配置
│   │   ├── tsconfig.json                  【基础】Web TS 配置入口
│   │   ├── tsconfig.app.json              【基础】浏览器代码类型检查
│   │   ├── tsconfig.node.json             【基础】工具配置类型检查
│   │   ├── .env.example                   【基础】公开的 Web 环境变量示例
│   │   ├── public/
│   │   │   └── icons/                     【基础】实际需要的 PWA 图标
│   │   │       ├── app-icon-192-v1.png
│   │   │       ├── app-icon-512-v1.png
│   │   │       ├── app-icon-maskable-512-v1.png
│   │   │       ├── apple-touch-icon-180-v1.png
│   │   │       └── favicon-32-v1.png
│   │   └── src/
│   │       ├── main.ts                    【基础】应用启动与插件注册
│   │       ├── App.vue                    【基础】应用根组件
│   │       ├── vite-env.d.ts              【基础】Vite 类型声明
│   │       ├── router/
│   │       │   └── index.ts               【基础】路由表
│   │       ├── styles/
│   │       │   ├── main.css               【基础】全局基础样式与页面布局
│   │       │   ├── vant-theme.css         【按需】Vant 主题变量覆盖
│   │       │   ├── kitchen.css            【业务】厨房屏高对比、大字号、无动画样式
│   │       │   └── custom.scss            【按需】复杂自定义样式
│   │       ├── api/
│   │       │   ├── client.ts              【基础】统一 Axios 实例
│   │       │   ├── health.ts              【基础】共享 Schema 校验 API 联通响应
│   │       │   ├── recipes.ts             【业务】菜谱 API 函数
│   │       │   └── kitchen.ts             【业务】厨房会话 API 函数
│   │       ├── layouts/
│   │       │   └── AppLayout.vue          【按需】多页面复用布局
│   │       ├── views/
│   │       │   ├── system/                【基础】非业务联通检查
│   │       │   │   └── HomeView.vue
│   │       │   ├── recipes/               【业务】菜谱路由页面
│   │       │   │   ├── RecipeListView.vue
│   │       │   │   ├── RecipeCreateView.vue
│   │       │   │   ├── RecipeEditView.vue
│   │       │   │   ├── RecipeDetailView.vue
│   │       │   │   └── RecipeImportView.vue   JSON 批量导入
│   │       │   ├── kitchen/               【业务】厨房屏只读页面（平板常亮展示）
│   │       │   │   └── KitchenDisplayView.vue
│   │       │   └── history/               【业务】做饭历史页面
│   │       │       └── CookingHistoryView.vue
│   │       ├── components/
│   │       │   ├── common/                【已实现】跨业务可复用组件
│   │       │   │   └── PageHeader.vue
│   │       │   ├── recipes/               【业务】菜谱专用组件
│   │       │   │   ├── RecipeForm.vue      新增与编辑共用
│   │       │   │   ├── RecipeBasicFields.vue
│   │       │   │   ├── RecipeTagPicker.vue
│   │       │   │   ├── IngredientEditor.vue
│   │       │   │   ├── RecipeStepsEditor.vue
│   │       │   │   └── AutocompleteInput.vue
│   │       │   └── kitchen/               【业务】厨房屏专用组件
│   │       │       └── KitchenMenuPanel.vue
│   │       ├── composables/               【按需】可复用组合逻辑
│   │       │   └── useWakeLock.ts         【业务】厨房页屏幕常亮，封装 Screen Wake Lock API
│   │       ├── domain/
│   │       │   └── recipe-form.ts          已实现：草稿与Contract映射纯函数
│   │       ├── stores/                    【按需】跨页面 Pinia 状态
│   │       ├── assets/                    【按需】由构建工具处理的资源
│   │       ├── utils/                     【按需】无副作用工具函数
│   │       └── test/
│   │           └── setup.ts               【按需】测试确有公共配置时创建
│   │
│   └── api/
│       ├── package.json                   【基础】API 依赖与命令
│       ├── tsconfig.json                  【基础】API 编译配置
│       ├── tsconfig.check.json            【基础】包含测试、Seed 与工具配置的类型检查
│       ├── vitest.config.ts               【基础】后端测试配置
│       ├── .env.example                   【基础】数据库、默认用户、监听地址与日志级别；厨房配置在业务实现时添加
│       ├── prisma.config.ts               【基础*】依所选 Prisma 版本配置
│       ├── prisma/
│       │   ├── schema.prisma              【基础】User 等数据库模型
│       │   ├── seed.ts                    【基础】幂等的默认用户 Seed
│       │   └── migrations/                【基础】通过迁移命令生成并提交
│       ├── src/
│       │   ├── app.ts                     【基础】构造 Fastify，不直接监听
│       │   ├── server.ts                  【基础】启动监听与优雅退出
│       │   ├── config/
│       │   │   └── env.ts                 【基础】读取和校验服务端环境变量
│       │   ├── plugins/
│       │   │   ├── prisma.ts              【基础】数据库客户端生命周期
│       │   │   └── error-handler.ts       【基础】统一错误响应与日志
│       │   ├── common/                    【按需】跨模块后端工具
│       │   ├── storage/                   【V2】图片功能时实现
│       │   │   └── local-storage.ts        本地文件写入与删除
│       │   └── modules/
│       │       ├── health/                【基础】用于验证 API 启动
│       │       │   ├── health.route.ts
│       │       │   └── health.test.ts
│       │       ├── recipes/               【业务】菜谱模块
│       │       │   ├── recipe.route.ts
│       │       │   ├── recipe.service.ts
│       │       │   ├── recipe.controller.ts    【按需】HTTP 转换
│       │       │   ├── recipe.repository.ts    【按需】独立数据库访问
│       │       │   ├── recipe.schema.ts        【按需】服务端专用校验
│       │       │   ├── recipe-import.service.ts 【业务】JSON 批量导入校验与写入
│       │       │   ├── recipe-import.service.test.ts
│       │       │   └── recipe.service.test.ts  【按需】有独立业务逻辑时
│       │       ├── kitchen/               【业务】厨房会话模块
│       │       │   ├── kitchen.route.ts
│       │       │   └── kitchen.service.ts
│       │       ├── ingredients/           【按需】需要独立管理食材时；V1 食材内嵌在菜谱中
│       │       ├── categories/            【按需】tags 需要治理时；V1 用 tags 代替分类
│       │       ├── users/                 【按需】需要用户业务 API 时
│       │       └── todos/                 【业务】未来整合 Todo 时
│       └── tests/
│           ├── integration/
│           │   ├── recipes.test.ts        【业务】菜谱增删改查与批量导入的 API 集成验证
│           │   └── kitchen.test.ts        【业务】厨房会话读写与删除菜谱时的联动
│           └── helpers/
│               └── test-app.ts            【按需】复用应用和数据库测试设置
│
├── packages/
│   └── shared/
│       ├── package.json                   【基础】依赖与导出入口
│       ├── tsconfig.json                  【基础】共享包编译配置
│       └── src/
│           ├── index.ts                   【基础】公开导出
│           ├── schemas/
│           │   ├── health.ts              【基础】验证两端导入的实际 Contract
│           │   ├── recipe.ts              【业务】菜谱请求、响应与推导类型
│           │   ├── recipe-import.ts       【业务】批量导入文件结构，复用 recipe Schema
│           │   └── kitchen.ts             【业务】厨房会话请求与响应
│           ├── constants/                 【按需】共享业务常量
│           └── types/                     【按需】不能由 Schema 推导的共享类型
│
├── docs/
│   ├── requirements/
│   │   └── REQUIREMENTS_V1.md             已创建：V1 功能范围、数据模型、厨房屏方案与验收标准
│   ├── architecture/
│   │   ├── TECH_STACK.md                  已创建：技术决策与边界
│   │   ├── PROJECT_MAP.md                 已创建：实际完整文件清单与职责，同次维护
│   │   └── PROJECT_STRUCTURE.md           已创建：本目标规划文件
│   ├── design/                           已创建：V1 设计初稿，不代表业务已实现
│   │   ├── README.md                     设计书索引、页面/API 对应关系与设计取舍
│   │   ├── COMMON.md                     共通视觉、数据 Contract、错误与事务
│   │   ├── screens/                      每画面一份，业务/验收设计与独立提示词链接
│   │   │   ├── S00_HOME.md               基础首页（过渡页）
│   │   │   ├── S01_RECIPE_LIST.md         菜谱一览与随机推荐区/换一个
│   │   │   ├── S02_RECIPE_DETAIL.md       菜谱详情
│   │   │   ├── S03_RECIPE_CREATE.md       新增菜谱
│   │   │   ├── S04_RECIPE_EDIT.md         编辑菜谱
│   │   │   ├── S05_RECIPE_IMPORT.md       JSON 批量导入
│   │   │   ├── S06_KITCHEN_DISPLAY.md     厨房显示与各状态
│   │   │   ├── S07_KITCHEN_PANEL.md       共用发送/查看厨房菜单弹层
│   │   │   ├── S08_COOKING_HISTORY.md     做饭历史、最新做法入口与删除误记
│   │   │   └── images/                   已创建：9张Memo V3主图、2张补充图与唯一提示词入口，非页面实现
│   │   │       ├── README.md             图集索引、使用边界与差异说明
│   │   │       ├── PROMPTS.md            当前生成/修改提示词、补充状态与历史输入记录
│   │   │       └── S00–S08 对应的 -v3.png 主图、表单中段与厨房横屏补充图（旧图已删除）
│   │   └── apis/                         每个 Method + Path 一份
│   │       ├── A01_HEALTH_GET.md
│   │       ├── A02_RECIPES_GET.md
│   │       ├── A03_RECIPE_TAGS_GET.md
│   │       ├── A04_RECIPE_GET.md
│   │       ├── A05_RECIPE_POST.md
│   │       ├── A06_RECIPE_PUT.md
│   │       ├── A07_RECIPE_DELETE.md
│   │       ├── A08_IMPORT_VALIDATE_POST.md
│   │       ├── A09_IMPORT_POST.md
│   │       ├── A10_KITCHEN_GET.md
│   │       ├── A11_KITCHEN_PUT.md
│   │       ├── A12_KITCHEN_ACTIVE_PATCH.md
│   │       ├── A13_KITCHEN_DELETE.md
│   │       ├── A14_RECIPE_RANDOM_GET.md   全部已有菜谱随机推荐，换一个排除当前
│   │       ├── A15_KITCHEN_COMPLETE_POST.md 完成时记整顿历史与清空同事务
│   │       ├── A16_COOKING_HISTORY_GET.md 历史分页
│   │       ├── A17_COOKING_HISTORY_POST.md 单菜手动记录
│   │       └── A18_COOKING_HISTORY_DELETE.md 删除一次完整历史，不恢复厨房
│   ├── development/
│   │   ├── SETUP.md                       【基础】详细环境与启动说明
│   │   ├── AI_WORKFLOW.md                 已创建：规则、Skills、Agents 与验收交接流程
│   │   ├── LAN_ACCESS.md                  【按需】平板访问与 HTTPS 实测说明
│   │   └── KITCHEN_TABLET.md              【业务】厨房平板设置：加桌面、屏幕超时、充电上限；Fully Kiosk 接入步骤
│   ├── api/                              【按需】实施后的接口使用概览；逐接口设计见 design/apis
│   │   ├── recipes.md                     【按需】菜谱接口使用概览，不复制精确 Contract
│   │   └── kitchen.md                     【按需】厨房接口使用概览，不复制精确 Contract
│   └── examples/
│       └── recipes-import.example.json    【业务】可直接导入的批量导入示例
│
└── storage/                               【V2】图片功能时的本地开发运行数据，不提交
    ├── images/
    │   ├── recipes/
    │   └── ingredients/                   【按需】食材图片出现后
    └── uploads/                           【按需】确有临时上传需求时
```

上图采用 compose.yaml；原规划中的 docker-compose.yml 也可以使用，只需选一种名称统一文档和命令。Prisma、Vant 和 PWA 的配置细节以初始化时选定的兼容版本为准，不为满足目录图强行创建配置文件。

apps/web 是手机优先的 Vue 3 + Vant 4 PWA，兼顾平板和桌面浏览器的基本访问，不使用 Tailwind CSS。未来确有 PC 管理需求时，可以在同一 Monorepo 中新增 apps/admin，使用适合桌面管理界面的组件库，共用 apps/api 与 packages/shared；当前不创建该应用。若届时选择独立仓库，再明确共享 Contract 的分发方式。

## 3. 根目录职责

根 package.json 提供统一的开发、构建、类型检查、lint、格式检查与测试命令，具体脚本在应用初始化后建立。声明固定的 pnpm 版本，并记录 Node.js 版本要求。

pnpm-workspace.yaml 包含 apps/* 与 packages/*。每个应用单独声明自己的依赖；不能因为根目录安装了某个依赖就隐式使用它。

tsconfig.base.json 只放公共严格检查选项。Web 与 API 的运行环境不同，DOM 类型、模块解析和产物路径应由各包自己的配置决定。

README.md 保持简短：项目简介、技术栈简介、Quick Start、目录简介、文档链接。安装细节放 SETUP.md，架构说明放本目录。

## 4. Web 目录职责

- views：路由页面，负责页面组合与流程。
- components：可复用 UI；业务组件归对应业务子目录。
- api：HTTP 配置及接口函数；返回 shared 中的 API 类型。
- composables：确实需要复用的 Vue 状态或行为。
- stores：跨页面共享状态；不要缓存所有 API 数据作为默认做法。
- router：路由表及未来的路由守卫。
- styles：全局样式；组件专用样式靠近组件。
- assets：参与构建的资源；public 放需要按固定名称直接提供的资源。

Vant 组件按需引入，主题优先使用 CSS 变量调整。页面布局使用 CSS Flex / Grid 与媒体查询，SCSS 按需使用。不要默认将所有 Vant 组件再包装一层；只有确有业务复用需求时才建立公共组件。

初期沿用这些技术目录即可，不额外建立第二套完整的 features 结构。功能规模增长后再评估是否调整。

## 5. API 模块职责

推荐的数据流：

```text
Route → Service → Prisma
```

复杂度增加后可以演进为：

```text
Route → Controller → Service → Repository → Prisma
```

Route 声明 URL、Method 并接入校验；Controller 处理 HTTP 转换；Service 处理业务规则；Repository 管理数据库访问。是否拆层由实际复杂度决定。

User Model 与 Seed 从初始化开始存在，但不因此创建空 users 模块。V1 默认用户由后端配置确定；未来身份认证再新增认证插件及用户接口。

common 只放多个模块实际共用的代码，不能成为无法归类的文件堆积区。文件存储逻辑放 src/storage，真实数据放 STORAGE_ROOT 指定的目录，两者职责不同。

## 6. Shared 与 API Contract

请求与响应 Schema 放在 shared/src/schemas，优先用 z.infer 推导类型，避免在 types 中重复手写同一结构。服务端专有的校验和数据库细节留在 apps/api。

例如新增菜谱时，Web 使用共享 Schema 校验提交内容，API 再执行同样的基础输入校验并检查业务规则。API 响应字段由共享 Contract 约定，不直接暴露 Prisma 返回的全部字段。

docs/design/apis 已按接口记录预定请求响应、业务规则与失败行为，画面设计与 AI 设计图提示词在 docs/design/screens。入口见 [设计书索引](../design/README.md)。当前业务 Contract 尚未实现，实施后精确字段以 shared Schema 为准，并同步设计书。docs/api 只在需要实施后的使用概览时创建，不重复维护两套逐接口说明。

## 7. Prisma 与测试数据

schema.prisma 定义模型，migrations 保存迁移历史，seed.ts 创建可重复执行的基础数据。迁移文件由工具生成并检查，不手工伪造初始化成功。

单元测试靠近被测代码；需要真实数据库的 API 测试放 tests/integration。集成测试使用独立测试数据库，不能清空日常使用的开发数据库。

Prisma 生成的客户端和构建产物不提交。生成位置按所选版本明确配置，并让 .gitignore 与构建流程匹配。

## 8. 环境变量与 Storage

- 根 .env.example：Compose 使用的数据库名、用户名及密码占位示例。
- apps/api/.env.example：DATABASE_URL、HOST、PORT、日志与默认用户配置；厨房参数在实现时添加，STORAGE_ROOT 属于 V2 上传阶段。
- apps/web/.env.example：只放允许公开的配置，例如 API 前缀；VITE_ 变量会进入客户端。

初始化时说明各文件如何加载，不假设根 .env 会自动被所有工具读取。真实 .env 不提交，也不把密钥写进 AI Instructions。

storage/ 在首次上传功能需要时自动创建，并被 Git 忽略。数据库 Volume、图片和 .env 都是运行数据或私有配置，不属于源代码。

## 9. AI Coding 配置

| 文件                                   | 职责                                            | 创建时机                      |
| -------------------------------------- | ----------------------------------------------- | ----------------------------- |
| .github/copilot-instructions.md        | 唯一全局入口：中文、解耦、验证、地图和Git规则   | 已创建                        |
| .github/instructions/*.instructions.md | Web 与 API/shared 范围规则，含对应测试约束      | 已创建                        |
| .github/agents/*.agent.md              | Frontend、Backend、只读 Reviewer 职责及工具范围 | 已创建                        |
| .github/skills/*/SKILL.md              | Git发布、画面、API、数据库迁移、评审、地图维护  | 已创建，按任务使用            |
| docs/architecture/PROJECT_MAP.md       | 真实文件清单与每文件职责，不包含规划/产物       | 已创建，每次结构/职责变化维护 |
| docs/development/AI_WORKFLOW.md        | 用户如何选择角色、Skills、验收与交接            | 已创建                        |

仅使用 copilot-instructions.md，不再创建重复的 AGENTS.md。架构细节以 docs/architecture 为依据；AI 入口保留高频规则和文档引用。实际文件地图见 [PROJECT_MAP.md](./PROJECT_MAP.md)，使用与检查步骤见 [AI_WORKFLOW.md](../development/AI_WORKFLOW.md)。规则属于指引，不是自动强制的hook；实际使用时检查工具是否加载了相应规则。

当前以 Copilot 开发为主，不规划 Claude Code 专用入口文件。Custom Agent 中明确任务开始时需要阅读的项目规则、架构文档及对应范围的 Instructions，按任务加载相关内容即可。Agent 中的阅读要求只在该 Agent 被使用时起作用；所有任务共同遵守的关键规则仍应放在 Copilot 仓库级 Instructions 中。未来实际切换工具时，再检查目标工具的加载机制并补充必要配置。

三个 Agent 的目标职责：Frontend 负责 apps/web；Backend 负责 apps/api 和初期数据库；Reviewer 检查前后端、shared、错误处理、测试与不必要的复杂度。职责定义不代表必须同时运行多个 Agent。

切换工具时可以复用代码、文档和工作流程，但 Custom Agent / Skill 的目录、字段及工具配置需按目标工具检查，不能认为配置文件全部直接兼容。重要决定与当前进度应留在仓库，不能只依赖聊天历史。

## 10. 给 Copilot 的分步创建顺序

| 步骤 | 创建范围                                       | 验收标准                                            |
| ---- | ---------------------------------------------- | --------------------------------------------------- |
| 1    | 根 package.json、workspace、版本约束、忽略规则 | pnpm 能识别三个 workspace 包                        |
| 2    | Vue / Vite 基础、路由、Vant 按需引入、样式     | 本机页面与 Vant 组件能运行，Web 类型检查与构建通过  |
| 3    | Fastify、环境校验、health                      | API 能启动，health 测试通过，能正常退出             |
| 4    | shared 与 health Contract                      | Web / API 都能导入，构建后的 API 也能运行           |
| 5    | Compose、Prisma、User 迁移、Seed               | 数据库持久化；迁移成功；Seed 重复执行不重复创建用户 |
| 6    | Axios、开发代理、基础联通                      | 页面能读取 API health 响应                          |
| 7    | ESLint、Prettier、测试、文档和 AI 规则         | 统一检查命令通过；启动说明可重复执行                |
| 8    | Manifest、图标、PWA 配置、LAN 实测             | 平板访问正常；HTTPS 条件具备后单独验证 PWA          |
| 9    | 总结文件与验证结果                             | 用户确认基础工程后再开始新增菜谱                    |

每一步可以由 AI 写代码，但需要保留实际执行的命令、结果和未验证事项。不要把“文件已生成”当作“工程已跑通”。

第一条业务链路只建立新增菜谱需要的模型、共享 Schema、API、表单和测试。分类、食材、图片是否同批实现，由该功能的最小需求决定。业务链路的建议顺序：新增菜谱 → 列表与详情 → 编辑与删除 → JSON 批量导入 → 厨房会话与厨房屏页面。

功能范围与验收标准见 [REQUIREMENTS_V1.md](../requirements/REQUIREMENTS_V1.md)，技术用途与 V1 边界见 [TECH_STACK.md](./TECH_STACK.md)。

品牌资源已保存于 `docs/design/brand/`：`app-logo-v1.png` 为原图，`README.md` 说明各尺寸用途。实际文件清单以 PROJECT_MAP.md 为准。
