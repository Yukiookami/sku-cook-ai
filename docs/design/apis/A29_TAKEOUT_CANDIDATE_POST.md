# A29 POST /api/takeout/candidates

状态：API源码、shared Contract和Web管理页已实现；本机迁移/数据库验收进行中。调用方：[S13 外卖候选管理](../screens/S13_TAKEOUT.md)。

## 请求

必须认证，无查询参数；严格JSON Body：

```json
{
  "name": "店铺或菜品名称",
  "url": "https://example.com/share"
}
```

`name` trim后1–100字符；`url` trim后1–2048字符，有效HTTP(S)，host必须非空，不允许嵌入URL用户名/密码；拒绝未知字段。客户端不提供userId。服务端先锁认证用户行，用户内URL哈希查重后写入。

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

## 错误

- 400 `INVALID_INPUT`：Body/query参数错误、未知字段或URL协议不支持。
- 401 `UNAUTHENTICATED`：缺少/无效会话。
- 409 `TAKEOUT_URL_CONFLICT`：该用户已添加相同trim后URL。
- 503 `SERVICE_UNAVAILABLE`：数据库不可用。
