# A14 GET /api/recipes/random

状态：源码已实现；初始迁移已应用于本地开发数据库；A14真实数据库HTTP行为尚未单独验收。调用方：[S01](../screens/S01_RECIPE_LIST.md)“随机推荐 / 换一个”。这是应用内只读随机推荐，不是通知、定时推送或AI服务。shared `RecipeRandomQuerySchema` / `RecipeRandomResponseSchema` 复用[COMMON RecipeSummary](../COMMON.md#32-recipe--recipesummary)。

## 1. 请求

| Query           | 规则                                           |
| --------------- | ---------------------------------------------- |
| excludeRecipeId | 可选正整数；“换一个”传当前推荐id，首次推荐省略 |

无Body，不接userId、q、tag、page/pageSize或推荐历史数组。未知Query拒绝；非法id返回400，不静默忽略。列表筛选与此API无关。

示例：`GET /api/recipes/random`；换掉当前101：`GET /api/recipes/random?excludeRecipeId=101`。

路径 `random` 与 `tags` 为静态路由，不能误送入 `/api/recipes/:id` 正整数校验；实施时验证路由匹配。

## 2. 成功200

有候选时只返回一道摘要，recipe非null、reason=null：

```json
{
  "recipe": {
    "id": 102,
    "title": "青椒肉丝",
    "description": "肉丝滑嫩，青椒清香",
    "servings": 2,
    "prepMinutes": 10,
    "cookMinutes": 15,
    "difficulty": "easy",
    "tags": ["家常菜"],
    "updatedAt": "2026-10-08T05:00:00.000Z"
  },
  "reason": null
}
```

无可推荐候选仍为200，显式区分正常业务状态：

```json
{ "recipe": null, "reason": "EMPTY_LIBRARY" }
```

```json
{ "recipe": null, "reason": "NO_ALTERNATIVE" }
```

- EMPTY_LIBRARY：默认用户没有任何菜谱，不论是否传排除id。
- NO_ALTERNATIVE：用户仍有菜谱，但全部被当前唯一排除id排除（即只有该道）。页面保留旧结果并说明没有其他菜谱，不伪造替代。
- 响应是上述互斥形状；不能recipe有值却reason非null，也不能两者都null。查看做法调用既有A04，不在推荐响应附食材步骤。

## 3. 处理与存储

校验Query → 按默认用户一次读取全部菜谱的摘要字段 → 内存排除excludeRecipeId → 从剩余候选等概率抽一个 → shared响应校验 → 返回 `Cache-Control: no-store`。

家庭百级规模先复用摘要DTO做单次一致读取，不查询正文、不随机猜测数据库id、不先取列表第一页，也不按updatedAt/标签加权。不存在/已删除/其他用户的排除id只是对本用户候选不产生影响，不额外查询或透露它是否属于其他用户。

候选为0时先按原集合是否为空确定reason，不能调用空区间随机函数。抽样使用Node原生随机值，无新依赖；实现提供抽样函数参数供索引边界单测，生产不使用固定索引。每次请求独立，不写历史、不改updatedAt、厨房菜单/版本，也不新增数据库模型或事务写入。

取到摘要后菜谱仍可能被其他操作删除；之后A04照常返回404，不承诺推荐快照长期有效。

## 4. 错误与测试

400 INVALID_INPUT：排除id非正整数、重复Query值或未知字段；500 INTERNAL_ERROR / 503 SERVICE_UNAVAILABLE按COMMON记录和返回。数据库或随机服务内部失败不能返回recipe=null的成功形状。

测试：

- 0道EMPTY_LIBRARY；1道首次能推荐，排除后NO_ALTERNATIVE；排除不存在id仍可推荐唯一菜。
- 2道时排除当前必得另一道；3道时排除当前，允许较早出现过的菜再次出现。
- 21条以上候选含未加载页，默认用户隔离、其他用户排除id无信息泄露；拒绝q/tag，不受列表筛选影响。
- 可控抽样覆盖首/中/末索引，每个候选都可被选，不以易波动的统计测试代替索引范围和候选集合验证。
- 非法Query、响应互斥、摘要完整及原份数、no-store、读取无写入、数据库失败非空成功、random静态路径与id路由不冲突。
