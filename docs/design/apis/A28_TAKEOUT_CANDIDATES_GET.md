# A28 GET /api/takeout/candidates

状态：API源码、shared Contract和Web管理页已实现；本机迁移/数据库验收进行中。调用方：[S13 外卖候选管理](../screens/S13_TAKEOUT.md)。

## 请求

- 必须认证；候选范围仅为会话关联用户。无查询参数；未知参数返回400。
- 业务读取使用`Cache-Control: no-store`。

## 响应 200

```json
{
  "items": [
    {
      "id": 12,
      "name": "店铺名称",
      "url": "https://example.com/share",
      "createdAt": "2026-10-12T00:00:00.000Z",
      "updatedAt": "2026-10-12T00:00:00.000Z"
    }
  ]
}
```

按`createdAt DESC, id DESC`排序。空库返回`{"items":[]}`。响应不含userId、URL哈希或其它数据库字段。

## 错误

- 401 `UNAUTHENTICATED`：缺少/无效会话。
- 400 `INVALID_INPUT`：提供未知查询字段。
- 503 `SERVICE_UNAVAILABLE`：数据库不可用；不能伪装成空列表。
