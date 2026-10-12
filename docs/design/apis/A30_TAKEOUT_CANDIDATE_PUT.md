# A30 PUT /api/takeout/candidates/:id

状态：API源码、shared Contract和Web管理页已实现；允许链接为空的迁移已应用于本机开发库，相关HTTP/数据库业务验收待完成。调用方：[S13 外卖候选管理](../screens/S13_TAKEOUT.md)。

## 请求

必须认证。`:id`为正整数；无查询参数。Body与[A29](A29_TAKEOUT_CANDIDATE_POST.md)完全相同，采用全量替换；可省略链接或提交空字符串以清除已有链接：

```json
{
  "name": "修改后的名称",
  "url": "https://example.com/new-share"
}
```

没有可用链接时可省略`url`或设为空字符串；响应中该字段统一返回`""`。

写入在认证用户行锁下完成。只查找当前用户的候选；不属于本人和不存在均为404。

## 响应 200

```json
{
  "candidate": {
    "id": 12,
    "name": "修改后的名称",
    "url": "https://example.com/new-share",
    "createdAt": "2026-10-12T00:00:00.000Z",
    "updatedAt": "2026-10-12T00:05:00.000Z"
  }
}
```

## 错误

- 400 `INVALID_INPUT`：id、Body/query字段或URL校验失败。
- 401 `UNAUTHENTICATED`：缺少/无效会话。
- 404 `TAKEOUT_CANDIDATE_NOT_FOUND`：不存在或不属于本人。
- 409 `TAKEOUT_URL_CONFLICT`：相同链接属于本用户的另一候选。
- 503 `SERVICE_UNAVAILABLE`：数据库不可用。
