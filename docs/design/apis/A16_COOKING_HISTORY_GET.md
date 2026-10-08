# A16 GET /api/cooking-history

状态：待实现。调用方：[S08](../screens/S08_COOKING_HISTORY.md)。预定 shared `CookingHistoryListQuerySchema` / `CookingHistoryListResponseSchema`，类型见[COMMON](../COMMON.md#35-做饭历史)。

## 请求

Query page为正整数默认1，pageSize为1～20默认20；无Body/userId。V1不接日期范围、统计、搜索、recipeId或自定义排序；非法/未知Query400。

## 成功200

```json
{
  "items": [
    {
      "id": 501,
      "cookedAt": "2026-10-08T09:30:00.000Z",
      "source": "kitchen",
      "items": [
        { "recipeId": 101, "title": "番茄炒蛋", "targetServings": 3 },
        { "recipeId": null, "title": "冬瓜汤", "targetServings": 1 }
      ]
    }
  ],
  "page": 1,
  "pageSize": 20,
  "hasMore": false
}
```

按默认用户过滤，以 `cookedAt DESC, id DESC` 排序，skip/take多一条判断hasMore；每页计数单位是**做饭次数**，不是菜品数。记录项按保存顺序，无食材步骤和数据库内部userId/sourceSessionRevision。时间ISO UTC，Web按浏览器本地时间显示日期时间，不使用相对日期掩盖原时间。

recipeId=null表示原菜谱已删除，title/targetServings仍保留；非null只能指向同用户现存菜谱。名字是当时保存的原名，不每次拼接最新菜名，也不静默过滤已删项。一致读取历史及从属项/可用菜谱状态。

空历史与末页正常200，items=[]、hasMore=false；返回Cache-Control:no-store，不写数据。分页不是多次请求的数据库快照，新增/删除后客户端重置第一页。不存在历史不补造记录。

## 错误与测试

400 INVALID_INPUT；500/503按COMMON，数据库失败不能返回成功空历史。历史归属、从属项或份数不变量破坏要日志加错误，不默默填1或丢掉条目。

测试0/20/21/40/41次、同时间id稳定、手动/kitchen、多道顺序、菜名改动不影响历史、删菜谱后null和旧名保留、默认用户隔离、只读/no-store、故障非空成功、无内部字段。
