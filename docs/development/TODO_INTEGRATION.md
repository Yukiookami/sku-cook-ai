# 发送采购清单到做什么事

状态：做菜端源码、版本化迁移和隔离测试已实现；本机开发库已在用户确认备份并授权后应用采购迁移。不代表其他部署环境已配置凭据、应用迁移或与实际 Todo 部署联通。Todo 仓库只读，不由本项目安装其依赖或导入其源码。

## 配置与身份

做菜后端配置 `TODO_ORIGIN`（默认 `https://todo.taila48442.ts.net`，必须精确 HTTPS origin，无路径/尾斜杠）、`TODO_COOK_INTEGRATION_TOKEN`、`TODO_COOK_USER_ID`。后两项同时缺省时关闭集成；只配置一项或格式不合法时拒绝启动。用户 ID 是本项目账号的稳定十进制数字 ID，不是用户名或邮箱；管理员可在用户列表核对 ID，或由有权限操作者只读查询。

Todo 后端配置相同的专用 token 和 cook user ID。token 为 32–256 个 URL-safe 字符，仅在两个服务端真实环境中保存；建议在本地密码管理器安全生成，不能粘贴到聊天、浏览器、URL、环境样例或日志。不要使用 Todo 个人访问密码。轮换后重启两端服务以加载配置，不能让浏览器传 token。

每个做菜 API 在已登录会话基础上比较 `String(authenticatedUser.id)` 与绑定 ID，包括预览、保存、读取和每次重试。其他账号返回 403；不能在请求体选择用户。Todo origin 仅由后端配置决定，前端不能指定请求目标。

网络请求固定为 `POST /api/v1/integrations/cook/batches`，仅携带 Bearer、JSON 类型和已持久化 payload；不转发 Cookie、Origin 或设备凭据，不跟随重定向。需要从做菜服务器访问 Tailscale 私网。不要用手机能打开 Todo 代替服务端网络验收。

## 数据和迁移

新增 `ShoppingBatch` 表，UUID 主键、用户外键（Restrict）、规范化 payload/hash、状态、错误码/安全消息、回执与发送租约。新增索引按用户/时间取最近 20 批。现有菜谱、食材、厨房和历史结构不变，无回填、删除或改写旧业务数据。删除用户需先制定采购账本保留方案，不能级联误删幂等记录。

迁移：`20261017063324_add_shopping_batches`。本机开发库已应用，无需重复操作；其他日常库升级需操作者确认目标、完成备份后单独运行 `pnpm --filter @sku-cook/api db:deploy`，不随启动或发布代码自动执行。Prisma Client 需 `pnpm db:generate`；不使用 reset 或 db push。不承诺自动 down migration；恢复采用已确认备份或前向修复。

先保存完整确认快照，再发外部请求；外部网络不占数据库事务。用户锁保证并发保存同一 ID 只建一行；同 ID、同规范化内容返回原记录，不同内容返回 `409 IDEMPOTENCY_CONFLICT`。已保存的旧菜谱之后改名或删除不影响原快照重试。

发送通过原子条件更新领取 30 秒租约；同时点击不能重复传输，崩溃后租约过期可重试。网络请求 10 秒超时；迟到的旧尝试通过 attemptId 防止覆盖新结果。失败/结果未知持久化为 failed，重试只取账本 payload。成功批次再点发送直接返回已验证回执；Todo 409 内容冲突持久化为 conflict，不自动换 ID。

接收 200/201 时校验回执 UUID 与原 batchId、taskId 和响应 data 一致，跳转 URL 必须与配置 Todo origin 相同且路径为 `/shopping/:batchId`，不能带凭据、参数或片段。仅返回安全投影，不向浏览器转发外部错误正文。回执不是当前购买进度；任务已删除时旧回执也不会创建新任务。

## 界面和接口

入口与交互见 [S14](../design/screens/S14_SHOPPING_PANEL.md)。五个接口：[A34](../design/apis/A34_SHOPPING_PREVIEW_POST.md)、[A35](../design/apis/A35_SHOPPING_BATCHES_GET.md)、[A36](../design/apis/A36_SHOPPING_BATCH_GET.md)、[A37](../design/apis/A37_SHOPPING_BATCH_PUT.md)、[A38](../design/apis/A38_SHOPPING_SEND_POST.md)。

做菜 shared 独立描述已公开的 schemaVersion 1 协议，不直接依赖 `@sku-memo/shared` 或另一仓库源码。约束以 Todo 的 `docs/development/COOK_INTEGRATION.md` 和实际 `task-contracts` 为依据；协议更新需两端协调，不静默放宽或截断。

## 验证

先构建 shared。采购数据库回归仅接受显式 `TEST_DATABASE_URL` 指向 **127.0.0.1:15436 / sku_cook_test_shopping** 专用临时数据库；不配置时跳过，错误目标直接失败。只在该临时库部署已有迁移再运行：

```sh
pnpm --filter @sku-cook/shared build
pnpm --filter @sku-cook/api exec vitest run src/modules/shopping/shopping.integration.test.ts
pnpm --filter @sku-cook/web exec vitest run src/components/kitchen/ShoppingPanel.test.ts
```

环境变量在本机设置并导出，不提交连接凭据。测试创建随机用户和真实批次，不清空已有表；测试库随独立容器销毁。本轮传输测试模拟 Todo 回执，验证真实做菜数据库的权限隔离、份数/原文、持久快照、并发发送、响应丢失重试、内容冲突和不可信链接拒绝，不冒称实际两端用户环境已联调。

另在同一临时容器的第二测试库按顺序应用六份旧迁移 SQL、插入旧用户/菜谱，再执行新增采购迁移 SQL，确认原菜谱及3人份数据保留、采购表为空。空库全迁移使用 Prisma 工具完成；带数据升级检查没有在日常库执行。Restrict 外键通过真实数据库回归验证，拒绝删除已有采购账本的用户且事务不会级联损坏菜谱。

浏览器在实际 CSS 320px/390px 手机视口检查了双按钮不溢出、底部内容可滚动到达、3人份预览、排除食材及持久发送回执。Todo传输为临时验收进程中的模拟，不访问实际Todo、不把模拟代码装入生产；确认成功结果滚回顶部且获得焦点。无独立采购设计PNG，不宣称逐像素还原，未做手机/平板真机验收。

其他环境部署前仍需：确认两端备份与迁移、专用凭据和绑定 ID、做菜服务器的 Todo HTTPS 可达性，再验证实际发送结果。做菜端不提供打开Todo的网页链接，不能保证通过该链接唤起已安装PWA；用户自行打开Todo检查。不能用真实日常采购冒充测试。
