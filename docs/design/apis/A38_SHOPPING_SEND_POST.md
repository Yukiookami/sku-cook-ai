# A38 POST /api/shopping/batches/:id/send

已实现；[S14](../screens/S14_SHOPPING_PANEL.md)发送和原批次重试。每次验证当前登录用户稳定ID匹配配置；`:id` UUID、query/body为空对象。不接受 URL、token 或新快照。

读取所属用户的账本，原子领取30秒发送租约，事务外向固定配置的Todo机器接口发送完整原payload。并发租约未到期返回409 `SHOPPING_SEND_IN_PROGRESS`；进程崩溃可在到期后原批次重试，attemptId防迟到写覆盖。Todo采用 batchId 幂等保证外部不重复。

200 `{batch}` 代表状态记录已更新，**只有 batch.status=succeeded 才表示收到成功回执**；failed/conflict不伪装成功。Todo 200/201校验meta的taskId/shoppingId/url/replayed，编号须与响应data及原批次一致，链接仅允许配置origin及`/shopping/:id`，无认证参数/片段。成功后直接返回保存回执，不再次调用Todo。

401保存配置错误说明；404 INTEGRATION_NOT_CONFIGURED说明未启用；429/5xx/网络或超时保存原批次待重试，明确可能已经送达；409 IDEMPOTENCY_CONFLICT持久化为conflict，不自动换ID。异常响应/外部正文不透传浏览器。采购完成/删除不会反向写厨房、历史，也不会因重试复建任务。配置和验证边界见[集成手册](../../development/TODO_INTEGRATION.md)。
