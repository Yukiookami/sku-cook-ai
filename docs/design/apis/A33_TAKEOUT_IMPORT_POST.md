# A33 POST /api/takeout/candidates/import

状态：API源码、shared Contract和S13文件/粘贴导入已实现；本机迁移与隔离数据库/HTTP业务验收通过。调用方：[S13 JSON导入](../screens/S13_TAKEOUT.md#3-json导入)。

## 请求

必须认证；JSON请求体最多10 MiB。严格Body：

```json
{
  "version": 1,
  "candidates": [{ "name": "店铺或菜品名称", "url": "https://example.com/share" }]
}
```

候选数1–1000；字段复用A29的名称、HTTP(S) URL规则。未知字段、非法项、文件内相同URL及当前用户已存在的URL均令整批失败，不写入任何项。服务端在认证用户锁内重新校验现存重复，再通过同一数据库事务批量写入；`(user_id,url_hash)`唯一索引兜底。与菜谱JSON协议相互独立。

## 响应 200

```json
{ "importedCount": 2 }
```

## 错误

- 400 `INVALID_INPUT`：无效JSON/未知查询参数等通用输入错误。
- 401 `UNAUTHENTICATED`：缺少/无效会话。
- 413 `PAYLOAD_TOO_LARGE`：请求体超过10 MiB。
- 422 `TAKEOUT_IMPORT_VALIDATION_FAILED`：版本、字段、数量、URL或重复链接校验失败，附`issues`路径；全批不写入。
- 409 `TAKEOUT_URL_CONFLICT`：数据库唯一约束捕获并发冲突；不返回成功。
- 503 `SERVICE_UNAVAILABLE`：数据库不可用；结果未知时客户端先重新读取，不自动重发。
