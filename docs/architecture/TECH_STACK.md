# V1 技术栈与开发边界

## 1. 项目目标

项目名称为“吃什么饭”，是供家庭日常使用的应用。V1 优先实现菜谱，之后再考虑整合已有 TodoList。浏览器标题、PWA 安装名称和产品首页统一使用“吃什么饭”；仓库名 sku-cook-ai、包名 @sku-cook/* 及 health 服务标识保持不变，不因产品命名调整协议或工程标识。

V1另有主动随机菜谱推荐与“换一个”，从已有菜谱抽取，不使用AI Runtime、通知服务或新增依赖。V2记录随机外卖及平台分享店铺/菜品链接管理，V1不接平台SDK、不抓取分享链接、不自动下单，细节见[需求10.1](../requirements/REQUIREMENTS_V1.md#101-v2随机外卖已记录v1不实施)。

采用 PWA First，以手机使用为主，同时适配 Android 平板及 iPad。Windows PC 和 Mac 可以通过浏览器访问，但 V1 不建设专门的桌面管理界面。未来需要 PC 管理端时，可以新增独立前端 App；是否独立仓库届时再决定。V1 不打包原生 App；未来确实需要原生能力时，再评估 Capacitor。

原则：先建立能运行、能验证、可维护的基础，再跑通一条完整业务链路。没有明确问题时不引入新技术。

## 2. 仓库与运行环境

| 技术           | 用途                       | V1 约定                                         |
| -------------- | -------------------------- | ----------------------------------------------- |
| Git            | 版本管理与回退             | 每个验收通过的小步骤单独提交                    |
| pnpm workspace | 管理 Monorepo 的依赖与脚本 | 不加入 Nx / Turborepo                           |
| Node.js        | 前端工具链与后端运行环境   | 使用受支持的 LTS，并记录版本                    |
| TypeScript     | 前后端与共享包的类型检查   | 启用 strict；构建和类型检查分别验证             |
| Docker Compose | 启动开发依赖               | 初期至少运行 PostgreSQL，Web / API 在宿主机运行 |

具体依赖版本在初始化时检查兼容性并通过 pnpm-lock.yaml 固定。不要在未确认适配关系时直接把全部依赖升级到最新版。

基础工程使用 Node.js 24 LTS（最低 24.20.0）、pnpm 12.10.1、@types/node 24、TypeScript 5.9、Vue 3、Vant 4、Vite 7、Fastify 5、Zod 4、Prisma 6.19.3、Vitest 3 与 ESLint 10。Prisma CLI / Client 保持相同版本；采用 6.x 内置 PostgreSQL 连接方案，不混入 Prisma 7 的 adapter 配置。精确安装版本以 lockfile 为准，启动与检查命令见 [SETUP.md](../development/SETUP.md)。

## 3. 前端：apps/web

| 技术                 | 用途                                | 使用约定                                                                    |
| -------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| Vue 3                | 页面与组件                          | Composition API，优先 script setup lang="ts"                                |
| Vite                 | 开发服务器与生产构建                | 开发阶段代理 /api 到 Fastify                                                |
| Vue Router           | 页面路由                            | 路由配置集中管理                                                            |
| Pinia                | 跨页面共享状态                      | 页面局部状态使用 ref / reactive，不默认放进 Store                           |
| Axios                | HTTP Client                         | 在 src/api/client.ts 集中配置，View 不直接发送请求                          |
| Vant 4               | Vue 3 移动端 UI 组件                | 用于表单、选择器、弹出层、导航等基础交互；按需引入                          |
| ExcelJS              | `.xlsx` 模板读写                    | 仅浏览器本地读取固定菜谱模板并生成空模板，不向服务端上传原始工作簿         |
| CSS / 按需 SCSS      | 页面布局与自定义样式                | 使用 Flex、Grid 和媒体查询；不引入 Tailwind CSS                             |
| vite-plugin-pwa      | Manifest、Service Worker 与更新机制 | V1 支持安装基础；离线业务写入暂不实现                                       |
| Screen Wake Lock API | 厨房屏有菜单时阻止自动熄屏          | 浏览器原生 API，无依赖；封装为 useWakeLock composable，仅 /kitchen 路由使用 |
| Vitest               | 单元测试运行器                      | 验证有价值的逻辑与行为                                                      |
| Vue Test Utils       | Vue 组件测试                        | 重点验证表单、校验和交互                                                    |
| ESLint / Prettier    | 代码检查与格式化                    | 检查逻辑与格式职责分开                                                      |

页面以手机布局为基准，平板通过内容宽度、卡片列数与留白调整。Vant 不替代页面响应式设计；菜谱卡片和详情布局按业务实现。组件外观优先通过 Vant 主题变量调整，组件专用样式放在 Vue 的 scoped style 中；SCSS 只在确有需要时使用。

API 错误转换为可理解的界面提示。共享的 Zod Schema 可以用于表单提交校验，但不能替代后端校验。

PWA 初期缓存静态资源；不默认缓存业务 API、上传内容或未来的用户私有响应。S09 的 ExcelJS 解析包按需加载且不加入预缓存，Excel 页面首次解析/下载模板和 A08/A09 导入需要网络。后续明确离线需求后再设计缓存策略。

Wake Lock 只能阻止熄屏，不能点亮已熄灭的屏幕；页面进入后台时锁会被系统释放，回到前台仍有菜单时需监听 visibilitychange 重新申请。与 Service Worker 一样需要安全上下文，局域网 IP 用 HTTP 访问时不可用，HTTPS 配置到位后一并验收。不支持、条件不满足或申请失败时保留菜谱阅读，厨房页提示无法自动常亮并给出系统屏幕超时的替代设置，不静默承诺常亮成功。具体交互见 [厨房画面设计书](../design/screens/S06_KITCHEN_DISPLAY.md)。

## 4. 后端：apps/api

| 技术                 | 用途                           | 使用约定                                          |
| -------------------- | ------------------------------ | ------------------------------------------------- |
| Node.js + TypeScript | API 运行与开发                 | 开发可使用 tsx；生产执行编译后的 JavaScript       |
| Fastify              | HTTP / REST API                | app.ts 构造实例，server.ts 负责启动和退出         |
| Zod                  | Body、Query、Params 与配置校验 | 业务请求约定优先定义在 shared；服务端必须校验输入 |
| Prisma               | PostgreSQL 访问与迁移          | Prisma Client 仅供后端使用                        |
| Pino                 | 结构化日志                     | 使用 Fastify 内置日志集成，避免重复建立日志系统   |
| Vitest               | 单元和集成测试运行器           | 业务逻辑与 API 行为按需要验证                     |
| Supertest            | HTTP API 集成测试              | 可针对 Fastify 的 Node HTTP Server 验证请求响应   |
| ESLint / Prettier    | 代码检查与格式化               | 与仓库公共配置保持一致                            |

Fastify 也提供 inject 测试能力。默认保留既定的 Supertest 方案；同一 API 场景不必同时写两套测试。

后端按业务模块组织。简单模块可以直接采用 route + service；只有 HTTP 转换、业务逻辑或数据库访问确实需要分离时才增加 controller / repository。不能为了目录完整而强制建立全部层。

统一处理参数错误、资源不存在和内部异常；记录内部错误日志，但不给客户端返回堆栈、数据库连接信息或其他敏感内容。

## 5. 数据库与账号

使用 PostgreSQL。Prisma Schema 与迁移文件是数据库结构的版本记录；本地容器的数据使用命名 Volume 持久化。

V1 使用后端固定默认用户。V2 增量加入用户名/密码注册、登录与显式退出；所有菜谱、厨房菜单和做饭历史按已认证账号隔离，客户端不能通过 user_id 自由指定数据归属。服务端凭据以单向哈希保存，会话使用 HttpOnly Cookie 并由服务端可撤销；不提供邮箱验证、找回密码或角色权限。服务端会话不因空闲自动失效，10 年持久 Cookie 在认证请求中滚动续期；浏览器策略、清除 Cookie 或设备存储清理仍可能结束本机登录状态。

首个账号为 Sku001。升级时保留原用户及其所有关联数据并归属该账号，不复制、不删除或重置现有业务记录。初始密码通过被忽略的本机环境配置传给幂等 Seed，不能写入源码、迁移、日志或提交；Seed 只保存其哈希。

用户模型包含：

| 字段                    | 约定                   |
| ----------------------- | ---------------------- |
| id                      | 用户主键               |
| username                | 登录名；忽略大小写唯一 |
| password_hash           | 单向密码哈希           |
| created_at / updated_at | 创建及更新时间         |

会话表只保存随机会话凭据的哈希并关联用户；登录 Cookie 不暴露用户 ID。Seed 创建或更新 Sku001 的认证资料时必须幂等且不能覆盖已变更的密码。

recipes、kitchen_sessions、cooking_histories 等个人业务表保存 user_id，并建立外键。ingredients、steps、tags 通过所属菜谱继承归属，不接受客户端指定用户。

账号功能需要验证未登录拒绝业务请求、登录态恢复、退出撤销会话、用户间菜谱/厨房/历史数据互不可见，以及旧数据升级后完整留在 Sku001 名下，不能仅以登录页面验收。

## 6. Shared Package：packages/shared

共享以下内容：

- Zod 请求与响应 Schema。
- 已确认的纯数字份数换算与用量格式化规则（待业务实施）：详情和厨房共用，不能依赖Vue、数据库或环境变量；原份数/目标份数/换算开关由Contract定义，不为份数计算新增API或依赖。
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

| 阶段 | 方案                     | 说明                                                                                                                                                                                                                                                        |
| ---- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1   | Chrome 加桌面 + 系统设置 | 屏幕超时自动熄屏，有菜单时由 Wake Lock 保持常亮；系统自带充电上限（三星“保护电池”、小米 / 华为“智能充电”），没有则用定时插座                                                                                                                                |
| 预留 | Fully Kiosk Browser      | Android 应用，把平板变成单一网页展示终端：开机自启、全屏锁定、空闲熄屏、定时亮屏熄屏、按电量触发 URL（配合智能插座控制充电）、崩溃自动重载、局域网 REST 接口（`?cmd=screenOn`）可远程亮屏。Plus 授权一次性付费、按设备计。Home Assistant 挂墙面板的标准做法 |

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

V1做饭历史使用既有Prisma/PostgreSQL，厨房完成在同一事务记录整顿并清空，手机清空不记录；详情手动记录、历史分页及删除误记均待业务实施，不新增依赖或历史快照存储。需求/Contract设计见[COMMON](../design/COMMON.md#35-做饭历史)。

预定视觉已改为奶油黄可爱Memo；Android厨房同配色、大字和按钮，不再为墨水屏强制黑白。本次只更新设计规范与当前提示词，现有技术验证页（非正式首页）、CSS和PWA运行时主题保持原状，正式页面开发再同步主题并做截图/真机验收。
