# AI 开发与交接工作流

## 1. 入口与加载

- 全局规则唯一入口：[copilot-instructions.md](../../.github/copilot-instructions.md)。不额外创建重复的AGENTS.md。
- [前端规则](../../.github/instructions/frontend.instructions.md)匹配apps/web；[后端规则](../../.github/instructions/backend.instructions.md)匹配apps/api、shared和Compose。
- [实际项目地图](../architecture/PROJECT_MAP.md)登记现存文件；[目标目录规划](../architecture/PROJECT_STRUCTURE.md)保留后续方向。不要按规划一次生成所有空文件。
- 规则是行为指引，不是强制执行的hook。编辑器/运行时是否自动加载需在使用时检查；未加载时显式附加Instructions或读取对应文件。Agent/Skill中也保留读取全局规则的步骤。

## 2. 自定义 Agent

| Agent                                              | 用途                      | 能力与边界                                            |
| -------------------------------------------------- | ------------------------- | ----------------------------------------------------- |
| [Frontend](../../.github/agents/frontend.agent.md) | 页面、表单、PWA、厨房显示 | 可读写并运行验证；主要apps/web，不擅改API/Prisma      |
| [Backend](../../.github/agents/backend.agent.md)   | API、shared、数据库       | 可读写并运行验证；Contract变更验证Web，不顺便重写前端 |
| [Reviewer](../../.github/agents/reviewer.agent.md) | RV、设计一致性与变更评审  | 仅read/search，不修改、不跑终端或数据库命令           |

在聊天Agent选择器选择角色；中文指明任务和设计书即可。未固定模型，使用当前工具配置。三个角色不需要同时运行，也不会自动互相循环委派。当前任务自己能完成时直接完成；跨边界需要清晰交接，不盲目增加Agent。

## 3. Skills

| 名称                                                                       | 触发任务                                    |
| -------------------------------------------------------------------------- | ------------------------------------------- |
| [git-publish](../../.github/skills/git-publish/SKILL.md)                   | 明确要求commit/push；手动流程，禁止自动发布 |
| [implement-screen](../../.github/skills/implement-screen/SKILL.md)         | 按Sxx设计书实现画面与测试                   |
| [implement-api](../../.github/skills/implement-api/SKILL.md)               | 按Axx设计书实现接口与Contract               |
| [database-migration](../../.github/skills/database-migration/SKILL.md)     | Prisma模型、迁移、约束或Seed变更            |
| [review-changes](../../.github/skills/review-changes/SKILL.md)             | RV、只读评审变更与验收证据                  |
| [maintain-project-map](../../.github/skills/maintain-project-map/SKILL.md) | 文件增删改名、职责变化与地图维护            |

可在支持Skills的工具中用对应斜杠入口，或直接说“用implement-screen实现S03”。Skill不是项目依赖，也不代表已经执行。git-publish配置为仅显式使用，避免普通编码任务顺便提交。

数据库单列一个Skill是因为迁移涉及持久数据、环境确认与不可逆风险；不另做“自动生成所有数据库”流程，也不让写API顺便reset数据库。

## 4. 建议的一次任务

```text
角色：Backend
目标：按A05实现新增菜谱API。
范围：对应shared Contract、最小模型/迁移、API和测试。
约束：按V1纯文字，不加登录；数据库只用明确的测试目标。
验收：请求响应匹配设计，字段校验/同名/回滚有测试。
交付：中文说明结果、检查、未验证事项，同步项目地图。
```

前后端联调可先Contract/API再页面，或协调并行实现已确定Contract；不能靠两个Agent各自推测接口。RV在完成业务切片后读取变更和真实验证证据，提出最小修正，不重新设计整套系统。

## 5. 项目地图维护与检查

每次结构变化同次维护PROJECT_MAP。下面是独立只读检查，不会生成或修改地图：

```powershell
node .github\skills\maintain-project-map\scripts\check-map.mjs
node --test .github\skills\maintain-project-map\scripts\check-map.test.mjs
```

检查列举git可见的现存源码、配置与文档（含未跟踪文件），排除依赖/产物/真实.env。已删除README不恢复，空目录不登记。检查能发现漏项与陈旧路径，但不能验证“一句话职责”是否仍准确。

## 6. 交接与提交

交接记录放直接相关设计书/环境文档，不另外散落临时进度Markdown。报告完成范围、设计取舍、真实命令结果、未验证事项；数据库未运行或真机未测要明确说明。

只在用户要求时使用git-publish，中文Conventional Commit，配套测试/文档/地图同提交。push不是commit的自动后续；已有用户暂存或删改要保留，密钥与运行数据不提交。
