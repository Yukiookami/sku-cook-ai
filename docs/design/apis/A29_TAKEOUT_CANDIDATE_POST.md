# A29 POST /api/takeout/candidates

状态：API源码、shared Contract和Web管理页已实现；允许链接为空的迁移已应用于本机开发库，相关HTTP/数据库业务验收待完成。调用方：[S13 外卖候选管理](../screens/S13_TAKEOUT.md)。

## 请求

必须认证，无查询参数；严格JSON Body：

```json
{
  "name": "店铺或菜品名称",
  "url": "https://example.com/share"
}
```

`name` trim后1–100字符；`url`可省略或为空字符串，非空时trim后最长2048字符且必须是有效HTTP(S)，host必须非空，不允许嵌入URL用户名/密码；拒绝未知字段。客户端不提供userId。服务端先锁认证用户行，仅对非空URL哈希查重后写入。无链接候选存储为`NULL`，响应统一以`url: ""`表示。

无链接请求示例：`{"name":"电话点餐店"}`。

## 响应 201

```json
{
  "candidate": {
    "id": 12,
    "name": "店铺或菜品名称",
    "url": "https://example.com/share",
    "createdAt": "2026-10-12T00:00:00.000Z",
    "updatedAt": "2026-10-12T00:00:00.000Z"
  }
}
```

响应不含userId/urlHash。
无链接候选响应中的`url`为`""`。

## 错误

- 400 `INVALID_INPUT`：Body/query参数错误、未知字段或URL协议不支持。
- 401 `UNAUTHENTICATED`：缺少/无效会话。
- 409 `TAKEOUT_URL_CONFLICT`：该用户已添加相同trim后URL。
- 503 `SERVICE_UNAVAILABLE`：数据库不可用。
