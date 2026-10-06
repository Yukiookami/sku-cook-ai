# 个人日常 App 开发 Memo

> 当前目标：先把项目做出来，再根据真实需求逐步扩展。  
> 核心原则：**PWA First、Monorepo、前后端 TypeScript、PostgreSQL、AI 能力按需加入，不做过度设计。**

## 1. 当前决定

- 前端：**Vue 3 + TypeScript + Vite**
- 后端：**Node.js + TypeScript**
- 数据库：**PostgreSQL**
- 应用形态：**PWA（优先）**
- 包管理：建议 **pnpm**
- 前后端代码：放在 **同一个 Git Repository（Monorepo）**
- AI 编码辅助：
  - GitHub Copilot
  - Claude Code
  - Instructions
  - Skills
  - Custom Agents
- 后续可选：
  - Docker / Docker Compose
  - pgvector
  - OpenAI / Claude API
  - Ollama 本地模型
  - LangChain / LangGraph
  - Capacitor Android

---

## 2. 为什么优先 PWA

目前手里有：

- Windows 开发电脑
- Android 平板

未来可能增加：

- Mac mini
- 厨房固定屏幕
- 门口 Todo 屏幕
- 手机 / iPad / Android 平板

因此第一版优先做 PWA。

```text
同一套 Vue 代码
     │
     ├── Windows 浏览器
     ├── Android 平板
     ├── iPhone / iPad
     ├── Mac
     └── 添加到主屏幕后作为 PWA 使用
```

优点：

- 不依赖 App Store
- 不需要 Apple Developer 付费即可使用
- Android / iOS / PC 都能访问
- 更新服务器后，各设备直接获得新版本
- 后续可以加入离线缓存
- 很适合家庭内部应用

如果未来确实需要 Android 原生能力，可以继续使用：

```text
Vue PWA
   ↓
Capacitor
   ↓
Android App
```

整体策略：

> **PWA First，Capacitor Optional**

---

## 3. 当前开发 / 部署计划

### Phase 1：现在

暂时不买新设备。

```text
Windows PC
├── Vue
├── Node.js
├── PostgreSQL
└── 图片 / 文件

        ↓ 家庭局域网

Android 平板
└── 浏览器 / PWA
```

先验证：

- 页面体验
- 手机 / 平板布局
- 数据同步
- API
- PWA 安装
- 家庭局域网访问
- 图片上传
- Todo / 菜谱核心功能

### Phase 2：项目稳定后

如果确认确实会长期使用，再考虑购买 Mac mini。

```text
Mac mini
├── Vue PWA
├── Node.js API
├── PostgreSQL
├── 图片 / 文件
└── Docker（可选）

       ↓

手机 / 平板 / PC / 固定屏幕
```

Mac mini 作为：

> **家庭应用服务器 + 数据中心**

而不是一开始就把它做成复杂 NAS 或 AI 服务器。

---

## 4. 推荐的整体项目结构

```text
personal-daily-app/
│
├── .github/
│   ├── copilot-instructions.md
│   │
│   ├── instructions/
│   │   ├── frontend.instructions.md
│   │   ├── backend.instructions.md
│   │   └── test.instructions.md
│   │
│   ├── agents/
│   │   ├── frontend.agent.md
│   │   ├── backend.agent.md
│   │   └── reviewer.agent.md
│   │
│   └── skills/
│       ├── create-vue-page/
│       │   └── SKILL.md
│       ├── create-api/
│       │   └── SKILL.md
│       ├── create-test/
│       │   └── SKILL.md
│       └── code-review/
│           └── SKILL.md
│
├── CLAUDE.md
│
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── views/
│   │   │   ├── router/
│   │   │   ├── stores/
│   │   │   ├── api/
│   │   │   ├── composables/
│   │   │   ├── types/
│   │   │   └── assets/
│   │   ├── public/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── api/
│       ├── src/
│       │   ├── routes/
│       │   ├── controllers/
│       │   ├── services/
│       │   ├── repositories/
│       │   ├── middleware/
│       │   ├── schemas/
│       │   ├── config/
│       │   └── app.ts
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── types/
│       ├── schemas/
│       ├── constants/
│       └── utils/
│
├── data/
│   ├── images/
│   └── uploads/
│
├── docker/
│
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 5. Monorepo 的思路

前端和后端不是混在一起写，而是：

```text
一个 Git Repository
        │
        ├── apps/web      Vue 前端
        ├── apps/api      Node 后端
        └── packages/shared
```

好处：

- 一个 Git 仓库统一管理
- 一个 Issue / PR 可以同时改前后端
- Copilot / Claude 可以同时理解完整项目
- Reviewer Agent 可以检查前后端接口一致性
- 前后端可以共享 TypeScript 类型
- CI / README / AI Instructions 都可以统一管理

---

## 6. Shared Package

因为前后端都使用 TypeScript，可以共享一些定义。

```text
packages/shared/
├── types/
│   ├── recipe.ts
│   └── todo.ts
├── schemas/
│   ├── recipe.schema.ts
│   └── todo.schema.ts
└── constants/
```

例如：

```ts
export interface Recipe {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
}
```

前端和后端都引用同一个类型，避免两边定义慢慢不一致。

后续可以考虑使用：

- Zod
- OpenAPI

进一步统一 API Contract。

---

## 7. 数据库与图片

PostgreSQL 作为主要数据库，例如：

```text
users
recipes
ingredients
recipe_ingredients
categories
favorites
todos
todo_lists
```

关系：

```text
Vue
 ↓
Node API
 ↓
PostgreSQL
```

Node 是业务后端，PostgreSQL 才是真正存储结构化数据的地方。

图片不建议直接存进数据库。

```text
PostgreSQL
└── 保存 imageUrl / imagePath

PC / Mac mini
└── 保存实际图片文件
```

例如：

```text
data/
└── images/
    ├── recipes/
    │   ├── xxx.jpg
    │   └── yyy.jpg
    └── ingredients/
```

未来如果迁移到 S3 / Cloudflare R2 / NAS，只需要替换文件存储方式。

---

## 8. AI Coding 配置

### Copilot Instructions

```text
.github/copilot-instructions.md
```

用于整个项目长期遵守的规则，例如：

- 使用 TypeScript
- 禁止滥用 `any`
- 前端使用 Vue 3
- 后端使用 Node.js
- API Contract 变更时检查前后端
- 优先复用已有代码
- 不擅自增加依赖

### Claude Code

```text
CLAUDE.md
```

作用和 `copilot-instructions.md` 很接近，可以维护一套相似的：

- 项目说明
- 技术栈
- 目录
- 开发规范
- 禁止事项
- 测试要求

### Path Specific Instructions

```text
.github/instructions/
```

例如：

```text
frontend.instructions.md
→ apps/web/**

backend.instructions.md
→ apps/api/**

test.instructions.md
→ **/*.test.*
```

---

## 9. Skills

Skills 表示：

> **遇到某一类任务时，应该按什么流程做。**

```text
.github/skills/
├── create-vue-page/
│   └── SKILL.md
├── create-api/
│   └── SKILL.md
├── create-test/
│   └── SKILL.md
└── code-review/
    └── SKILL.md
```

简单理解：

```text
Instructions
= 项目规则

Skills
= 做事方法 / SOP
```

例如 `create-api` Skill 可以规定：

```text
1. 确认 API Contract
2. 创建 Route
3. 创建 Controller
4. 创建 Service
5. 数据校验
6. 数据库操作
7. 错误处理
8. 添加 Test
9. 更新共享 Type
```

---

## 10. Custom Agents

第一版不要拆太多 Agent。

建议只使用：

```text
.github/agents/
├── frontend.agent.md
├── backend.agent.md
└── reviewer.agent.md
```

### Frontend Agent

负责：

```text
apps/web/**
```

职责：

- Vue 页面
- Component
- Pinia
- Router
- API Client
- PWA
- Responsive UI
- Frontend Test

边界：

- 不修改数据库 Schema
- 不直接改后端业务逻辑

### Backend Agent

负责：

```text
apps/api/**
```

职责：

- Node API
- Route
- Controller
- Service
- Repository
- Validation
- Authentication
- PostgreSQL
- Backend Test

初期数据库相关工作也可以由 Backend Agent 负责，暂时不需要 Database Agent。

### Reviewer Agent

负责检查：

```text
apps/web
apps/api
packages/shared
```

重点：

- Bug
- API Contract
- Type
- Error Handling
- Test
- Security
- 不必要的复杂设计
- 前后端是否一致

---

## 11. Instructions / Skills / Agents 的关系

```text
                    Instructions
                         │
                 所有人共同遵守
                         │
             ┌───────────┴───────────┐
             │                       │
       Frontend Agent          Backend Agent
             │                       │
       Frontend Skills         Backend Skills
             │                       │
             └───────────┬───────────┘
                         │
                    Reviewer Agent
```

简单记忆：

```text
Instructions
= 大家都必须遵守什么

Custom Agent
= 谁负责什么

Skill
= 具体应该怎么做

Subagent
= Agent 被主 Agent 派出去执行某个子任务
```

---

## 12. App 内的 AI 功能

AI Coding（Copilot / Claude Code）和 App 内 AI 功能是两件事。

未来如果 App 需要 AI，可以这样设计：

```text
Vue
 ↓
Node
 ↓
AI Service
 ├── Claude API
 ├── OpenAI API
 └── Ollama
```

业务代码不要直接绑定某一个模型。

例如：

```ts
interface LLMProvider {
  chat(message: string): Promise<string>;
}
```

实现：

```text
ClaudeProvider
OpenAIProvider
OllamaProvider
```

以后可以通过配置切换：

```env
LLM_PROVIDER=claude
```

或：

```env
LLM_PROVIDER=ollama
```

---

## 13. Mac mini 与 AI

Mac mini 将来主要负责：

```text
Mac mini
├── Vue
├── Node
├── PostgreSQL
├── 图片
└── 其他家庭 App
```

LLM 不一定必须跑在 Mac mini。

第一阶段：

```text
Mac mini
   ↓
Node AI Service
   ↓
Claude / OpenAI API
```

后续可以尝试：

```text
Mac mini
└── Ollama
     └── Local LLM
```

最终也可以做 Hybrid：

```text
                ┌── Local LLM
Node AI Router ─┤
                └── Cloud LLM
```

例如：

```text
简单分类 / 标签 / 摘要
→ 本地模型

复杂推理 / Agent / 高质量生成
→ Claude / OpenAI
```

---

## 14. pgvector

PostgreSQL 后续可以增加：

```text
pgvector
```

用途：

```text
菜谱文本
 ↓
Embedding
 ↓
Vector
 ↓
PostgreSQL + pgvector
```

然后可以实现类似：

> 想吃清淡一点，20 分钟以内能完成的鸡肉菜。

这种语义搜索。

第一版不需要立即加入。

---

## 15. LangChain / LangGraph

第一版也不需要。

先：

```text
Node
 ↓
OpenAI / Claude SDK
```

当出现：

- RAG
- 多步骤 AI 流程
- Tool Calling
- 多个数据源
- Agent

再考虑：

```text
LangChain.js
```

如果未来出现复杂状态、分支、循环、多 Agent，再考虑：

```text
LangGraph
```

推荐顺序：

```text
普通 Node API
      ↓
LLM SDK
      ↓
pgvector / RAG
      ↓
LangChain
      ↓
LangGraph
```

---

## 16. 第一阶段暂时不要做

为了避免过度设计，第一版暂时不需要：

```text
微服务
Kafka
Kubernetes
Redis
复杂 DDD
CQRS
Event Sourcing
多个 Database Agent
复杂 Multi-Agent
LangChain
LangGraph
本地大型 LLM
```

先把真正能用的 App 做出来。

---

## 17. 推荐开发顺序

### Step 1

建立 Monorepo：

```text
apps/web
apps/api
packages/shared
```

### Step 2

配置：

```text
Vue 3
Node.js
PostgreSQL
pnpm workspace
```

### Step 3

建立 AI Coding 配置：

```text
.github/copilot-instructions.md
CLAUDE.md

.github/instructions/
.github/agents/
.github/skills/
```

第一版：

```text
3 Agents
3～5 Skills
```

即可。

### Step 4

先实现一个完整功能，例如：

```text
新增菜谱
```

完整跑通：

```text
PostgreSQL
   ↓
Node API
   ↓
Vue 页面
   ↓
平板
```

包括：

- DB
- API
- 页面
- 图片
- Test

### Step 5

PWA：

```text
Android 平板
→ 浏览器访问
→ 添加到主屏幕
→ PWA 使用
```

### Step 6

家庭网络测试：

```text
Windows PC
   ↓
Node / PostgreSQL
   ↓ LAN
Android Tablet
```

实际使用一段时间。

### Step 7

再决定是否购买 Mac mini。

只有确认这个项目真的会长期使用，再迁移：

```text
Windows PC
    ↓
Mac mini
```

---

## 18. 当前总体架构

```text
                 手机 / Android 平板 / PC
                           │
                           │ PWA
                           ↓
                      Vue 3 + TS
                           │
                           │ HTTP API
                           ↓
                    Node.js + TS
                     /          \
                    /            \
                   ↓              ↓
             PostgreSQL        Images
                   │
                   │
            Future: pgvector
                   │
                   ↓
                AI Service
              /      |       \
             /       |        \
        Claude    OpenAI     Ollama
         Cloud     Cloud      Local
```

---

## 19. 开发原则

这个项目的核心原则：

> **先做出来，再优化。**

```text
第一版
= 能用

第二版
= 好用

第三版
= 自动化 / AI

第四版
= 多设备 / 家庭服务器 / 更多场景
```

每次增加新技术前先问：

> 现在有什么具体问题？

然后再选择：

> 哪个技术可以解决这个问题？

而不是：

> 我学到了一个新技术，所以我要把它加进项目。

---

## 20. 当前下一步

建议下一步只做三件事：

1. 创建 Git Repository
2. 建立 Monorepo 基础目录
3. 初始化 Vue + Node + PostgreSQL

之后从第一个完整功能开始开发。
