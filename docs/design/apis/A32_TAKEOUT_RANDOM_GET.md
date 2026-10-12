# A32 GET /api/takeout/random

状态：API源码、shared Contract和S01已实现；本机迁移/数据库验收进行中。调用方：[S01 点外卖推荐](../screens/S01_RECIPE_LIST.md#22-随机外卖)。

## 请求

必须认证，候选只从当前用户的外卖候选池选择。可选查询参数：

| 参数                 | 约束       | 含义                   |
| -------------------- | ---------- | ---------------------- |
| `excludeCandidateId` | 可选正整数 | 换一个时排除当前推荐项 |

忽略菜谱搜索/标签/列表分页，不修改任何候选或厨房数据。仅排除当前id，不保存推荐历史；其余项均匀随机。

## 响应 200

推荐成功：

```json
{
  "candidate": {
    "id": 12,
    "name": "店铺或菜名",
    "url": "https://example.com/share",
    "createdAt": "2026-10-12T00:00:00.000Z",
    "updatedAt": "2026-10-12T00:00:00.000Z"
  },
  "reason": null
}
```

无候选：`{"candidate":null,"reason":"EMPTY_LIBRARY"}`。排除后无其他候选：`{"candidate":null,"reason":"NO_ALTERNATIVE"}`。

## 错误

- 400 `INVALID_INPUT`：查询参数无效或包含未知字段。
- 401 `UNAUTHENTICATED`：缺少/无效会话。
- 503 `SERVICE_UNAVAILABLE`：数据库不可用，不能伪装成空池。
