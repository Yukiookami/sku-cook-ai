# A31 DELETE /api/takeout/candidates/:id

状态：API源码、shared Contract和Web管理页已实现；本机迁移/数据库验收进行中。调用方：[S13 外卖候选管理](../screens/S13_TAKEOUT.md)。

## 请求

必须认证；`:id`为正整数；无查询参数或Body。服务端按认证用户范围删除候选，不接受userId。删除在认证用户行锁下执行。

## 响应 204

无响应Body。

## 错误

- 400 `INVALID_INPUT`：id/query参数无效或包含未知字段。
- 401 `UNAUTHENTICATED`：缺少/无效会话。
- 404 `TAKEOUT_CANDIDATE_NOT_FOUND`：不存在或不属于本人。
- 503 `SERVICE_UNAVAILABLE`：数据库不可用。
