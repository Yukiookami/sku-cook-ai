# V1 技术栈与开发边界

## 1. 项目目标

Personal Daily App 是供家庭日常使用的应用。V1 优先实现菜谱，之后再考虑整合已有 TodoList。

采用 PWA First，以手机使用为主，同时适配 Android 平板及 iPad。Windows PC 和 Mac 可以通过浏览器访问，但 V1 不建设专门的桌面管理界面。未来需要 PC 管理端时，可以新增独立前端 App；是否独立仓库届时再决定。V1 不打包原生 App；未来确实需要原生能力时，再评估 Capacitor。

原则：先建立能运行、能验证、可维护的基础，再跑通一条完整业务链路。没有明确问题时不引入新技术。

## 2. 仓库与运行环境

| 技术 | 用途 | V1 约定 |
| --- | --- | --- |
| Git | 版本管理与回退 | 每个验收通过的小步骤单独提交 |
| pnpm workspace | 管理 Monorepo 的依赖与脚本 | 不加入 Nx / Turborepo |
| Node.js | 前端工具链与后端运行环境 | 初始化时选择受支持的 LTS，并记录版本 |
| TypeScript | 前后端与共享包的类型检查 | 启用 strict；构建和类型检查分别验证 |
| Docker Compose | 启动开发依赖 | 初期至少运行 PostgreSQL，Web / API 在宿主机运行 |

具体依赖版本在初始化时检查兼容性并通过 pnpm-lock.yaml 固定。不要在未确认适配关系时直接把全部依赖升级到最新版。

基础工程使用 Node.js 22 LTS（最低 22.18.0）、pnpm 10.34.6、TypeScript 5.9、Vue 3、Vant 4、Vite 7、Fastify 5、Zod 4、Prisma 6.19.3、Vitest 3 与 ESLint 10。Prisma CLI / Client 保持相同版本；采用 6.x 内置 PostgreSQL 连接方案，不混入 Prisma 7 的 adapter 配置。精确安装版本以 lockfile 为准，启动与检查命令见 [SETUP.md](../development/SETUP.md)。

## 3. 前端：apps/web

| 技术 | 用途 | 使用约定 |
| --- | --- | --- |
| Vue 3 | 页面与组件 | Composition API，优先 script setup lang="ts" |
| Vite | 开发服务器与生产构建 | 开发阶段代理 /api 到 Fastify |
| Vue Router | 页面路由 | 路由配置集中管理 |
| Pinia | 跨页面共享状态 | 页面局部状态使用 ref / reactive，不默认放进 Store |
| Axios | HTTP Client | 在 src/api/client.ts 集中配置，View 不直接发送请求 |
| Vant 4 | Vue 3 移动端 UI 组件 | 用于表单、选择器、弹出层、导航等基础交互；按需引入 |
| CSS / 按需 SCSS | 页面布局与自定义样式 | 使用 Flex、Grid 和媒体查询；不引入 Tailwind CSS |
| vite-plugin-pwa | Manifest、Service Worker 与更新机制 | V1 支持安装基础；离线业务写入暂不实现 |
| Screen Wake Lock API | 厨房屏有菜单时阻止自动熄屏 | 浏览器原生 API，无依赖；封装为 useWakeLock composable，仅 /kitchen 路由使用 |
| Vitest | 单元测试运行器 | 验证有价值的逻辑与行为 |
| Vue Test Utils | Vue 组件测试 | 重点验证表单、校验和交互 |
| ESLint / Prettier | 代码检查与格式化 | 检查逻辑与格式职责分开 |

页面以手机布局为基准，平板通过内容宽度、卡片列数与留白调整。Vant 不替代页面响应式设计；菜谱卡片和详情布局按业务实现。组件外观优先通过 Vant 主题变量调整，组件专用样式放在 Vue 的 scoped style 中；SCSS 只在确有需要时使用。

API 错误转换为可理解的界面提示。共享的 Zod Schema 可以用于表单提交校验，但不能替代后端校验。

PWA 初期缓存静态资源；不默认缓存业务 API、上传内容或未来的用户私有响应。后续明确离线需求后再设计缓存策略。

Wake Lock 只能阻止熄屏，不能点亮已熄灭的屏幕；页面进入后台时锁会被系统释放，回到前台仍有菜单时需监听 visibilitychange 重新申请。与 Service Worker 一样需要安全上下文，局域网 IP 用 HTTP 访问时不可用，HTTPS 配置到位后一并验收。不支持、条件不满足或申请失败时保留菜谱阅读，厨房页提示无法自动常亮并给出系统屏幕超时的替代设置，不静默承诺常亮成功。具体交互见 [厨房画面设计书](../design/screens/S06_KITCHEN_DISPLAY.md)。

## 4. 后端：apps/api

| 技术 | 用途 | 使用约定 |
| --- | --- | --- |
| Node.js + TypeScript | API 运行与开发 | 开发可使用 tsx；生产执行编译后的 JavaScript |
| Fastify | HTTP / REST API | app.ts 构造实例，server.ts 负责启动和退出 |
| Zod | Body、Query、Params 与配置校验 | 业务请求约定优先定义在 shared；服务端必须校验输入 |
| Prisma | PostgreSQL 访问与迁移 | Prisma Client 仅供后端使用 |
| Pino | 结构化日志 | 使用 Fastify 内置日志集成，避免重复建立日志系统 |
| Vitest | 单元和集成测试运行器 | 业务逻辑与 API 行为按需要验证 |
| Supertest | HTTP API 集成测试 | 可针对 Fastify 的 Node HTTP Server 验证请求响应 |
| ESLint / Prettier | 代码检查与格式化 | 与仓库公共配置保持一致 |

Fastify 也提供 inject 测试能力。默认保留既定的 Supertest 方案；同一 API 场景不必同时写两套测试。

后端按业务模块组织。简单模块可以直接采用 route + service；只有 HTTP 转换、业务逻辑或数据库访问确实需要分离时才增加 controller / repository。不能为了目录完整而强制建立全部层。

统一处理参数错误、资源不存在和内部异常；记录内部错误日志，但不给客户端返回堆栈、数据库连接信息或其他敏感内容。

## 5. 数据库与默认用户

使用 PostgreSQL。Prisma Schema 与迁移文件是数据库结构的版本记录；本地容器的数据使用命名 Volume 持久化。

V1 不实现登录 UI、注册、JWT 或密码认证。业务请求使用后端确定的默认用户，不能由客户端通过 user_id 自由指定数据归属。

用户模型预留字段：

| 字段 | 约定 |
| --- | --- |
| id | 用户主键 |
| name | 用户名称 |
| email | V1 可为空；存在时唯一 |
| password_hash | 可为空；未来认证时使用 |
| created_at / updated_at | 创建及更新时间 |

Seed 创建默认用户（建议 id = 1，name = default-user），重复执行不应产生重复用户。具体主键和命名映射在数据库初始化阶段统一确认。

recipes 等个人业务表保存 user_id，并建立外键。ingredients / categories 是个人数据还是家庭共享字典，在实现对应功能前明确；不要默认所有表都必须归属某个用户。

预留 user_id 有助于未来迁移，但正式多用户仍需要认证、服务端授权检查与数据隔离测试，不能仅增加登录页面。

## 6. Shared Package：packages/shared

共享以下内容：

- Zod 请求与响应 Schema。
- 由 Schema 推导的 TypeScript 类型。
- 前后端都需要的业务常量和 API Contract。

禁止放入 Prisma Client、数据库模型、服务端环境变量、文件系统访问、Vue 组件或 Axios Client。数据库模型不能直接作为公开 API 的响应类型。

共享包由自己的 package.json 显式声明导出入口。初始化时统一它的构建方式与 Web / API 的模块解析方式，并验证两端都能导入；不只依赖 tsconfig paths 隐藏运行时问题。

## 7. 图片与文件

数据库保存文件的相对标识或受控路径，真实文件存储在文件系统中，不存入 PostgreSQL。

通过 STORAGE_ROOT 指定实际数据目录。开发时可使用仓库下的 storage/；长期运行时将其指向仓库外的绝对目录，便于备份与代码迁移。

上传功能实现时需要限制大小、检查允许的文件类型、生成服务端文件名并防止路径穿越。文件公开 URL 与磁盘绝对路径分开处理。

先使用简单的本地存储实现；有迁移到 S3 / R2 / NAS 的具体需求后再扩展。备份必须同时覆盖 PostgreSQL 与文件存储。

## 8. 部署方向

第一阶段：

```text
手机 / 厨房平板 / 其他家庭设备
             ↓ 家庭局域网
Windows PC
├── Vue Web / PWA
├── Fastify API
├── PostgreSQL（Docker Compose）
└── 文件存储（V2 图片功能时启用）
```

开发时 Web 与 API 在 Windows 运行，PostgreSQL 使用 Docker。需要配置监听地址和防火墙，让平板访问开发电脑；数据库端口不应向家庭设备开放，宿主机访问可绑定到 127.0.0.1。

局域网 HTTP 可以先验证网页及 API。通过局域网 IP 访问时，Service Worker 和 Wake Lock 都需要 HTTPS 安全上下文，localhost 的例外不适用于平板访问电脑 IP。因此“网页能打开”和“PWA 可安装、可缓存、可常亮”分开验收；HTTPS 的具体配置在设备测试阶段决定。

长期运行时优先让 Web 与 /api 通过同一入口访问，减少跨域和配置复杂度。V1 仅用于可信家庭局域网，不直接暴露到公网。

未来确认长期使用后，再迁移到 Mac mini。保持环境变量配置、数据库迁移和存储目录清楚即可；现在不建设复杂的服务器部署体系。

### 8.1 厨房平板

厨房屏是一台闲置的 Android 平板，常插电，打开 `/kitchen` 路由加到桌面。它不是一台需要部署代码的设备，但有自己的运行配置，记录在 docs/development/KITCHEN_TABLET.md。

| 阶段 | 方案 | 说明 |
| --- | --- | --- |
| V1 | Chrome 加桌面 + 系统设置 | 屏幕超时自动熄屏，有菜单时由 Wake Lock 保持常亮；系统自带充电上限（三星“保护电池”、小米 / 华为“智能充电”），没有则用定时插座 |
| 预留 | Fully Kiosk Browser | Android 应用，把平板变成单一网页展示终端：开机自启、全屏锁定、空闲熄屏、定时亮屏熄屏、按电量触发 URL（配合智能插座控制充电）、崩溃自动重载、局域网 REST 接口（`?cmd=screenOn`）可远程亮屏。Plus 授权一次性付费、按设备计。Home Assistant 挂墙面板的标准做法 |

Fully Kiosk 是解决“开机要手点”“熄屏后手机发菜单它不亮”“电池管理”这些问题的现成方案，V1 不装，但不要在遇到这些问题时重新调研。接入它时代码侧只有一处改动：API 在“发送到厨房”成功后向 Fully 的 REST 接口发一个亮屏请求，地址和密码放在 `.env`，未配置时跳过。门口的 TodoList 显示屏届时使用同一套方案。

## 9. V1 不引入的技术

- Redis、Kafka、MongoDB、pgvector。
- 微服务、Kubernetes、CQRS、Event Sourcing、复杂 DDD。
- Nx / Turborepo。
- LangChain、LangGraph、Ollama、OpenAI / Claude API 等 AI Runtime。
- Capacitor 原生打包。
- JWT、argon2 与正式登录流程。
- 离线数据同步、后台队列与复杂存储抽象。
- Fully Kiosk Browser（厨房平板的 Kiosk 应用）：已评估，方案见 8.1，V1 先用 Chrome 加桌面。
- 图片上传与文件存储：V2 图片功能时启用第 7 节的方案。

这些是当前范围决定，不是永久禁止；出现具体需求后再单独评估。

## 10. 开发与验收方式

用户负责需求、方案选择和实际验收；Copilot 主要负责代码实现。其他 AI 工具可以接手同一仓库，项目知识应写进版本控制中的文档，而不是只留在聊天记录中。

每次任务包含目标、范围、约束、验收标准。AI 完成后应说明修改内容、实际运行的检查及未验证事项。

初始化分步验证：workspace → Web / API 启动 → 数据库与 Seed → shared 两端导入 → 检查工具 → PWA 与设备访问。基础工程验收后再实现新增菜谱，不一次生成全部业务模块。

相关目录规划见 [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)，V1 功能需求见 [REQUIREMENTS_V1.md](../requirements/REQUIREMENTS_V1.md)。

逐页面 / API 设计书与页面生成图提示词见 [V1 设计书索引](../design/README.md)。设计初稿不代表业务已实现；Wake Lock 失败降级、厨房轮询一致性与正式导入事务行为在设计中细化，实施时同步 shared Contract 与测试。
