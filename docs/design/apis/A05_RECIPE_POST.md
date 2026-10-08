# A05 POST /api/recipes

状态：待实现。调用方：[S03](../screens/S03_RECIPE_CREATE.md)。shared建议 `RecipeInputSchema` / `RecipeResponseSchema`。

## 1. 请求

Content-Type application/json，Body严格RecipeInput，见 [COMMON](../COMMON.md#31-recipeinput)。不接id、userId、图片、createdAt/updatedAt。

```json
{
  "title": "番茄炒蛋",
  "description": "十分钟家常菜",
  "servings": 2,
  "prepMinutes": 5,
  "cookMinutes": 10,
  "difficulty": "easy",
  "tags": ["家常菜", "快手"],
  "ingredients": [
    { "name": "鸡蛋", "amount": "3", "unit": "个" },
    { "name": "番茄", "amount": "2", "unit": "个", "note": "切块" },
    { "name": "盐", "amount": "适量" }
  ],
  "steps": [
    { "order": 1, "text": "鸡蛋打散，加少许盐。" },
    { "order": 2, "text": "热油下蛋液，凝固后盛出。" },
    { "order": 3, "text": "下番茄炒出汁，倒回鸡蛋翻匀。" }
  ],
  "tips": "番茄先用开水烫一下更容易去皮。"
}
```

## 2. 成功201

响应 `{ "recipe": Recipe }`，完整结构见 [COMMON 3.2](../COMMON.md#32-recipe--recipesummary)；`Location: /api/recipes/{id}`。创建时间由服务端确定，主键数据库生成。

## 3. 业务处理

校验/归一化 →服务端默认用户归属→检查同名便于提示→事务创建Recipe、从属食材步骤、标签→组装响应。数据库 `(userId, title)`唯一约束兜底并发同名，trim后相同就是冲突；不同用户可同名。不自动加入厨房菜单。

## 4. 错误与测试

400 INVALID_INPUT，issues精确定位食材/步骤；409 RECIPE_TITLE_CONFLICT定位title；413 PAYLOAD_TOO_LARGE；500/503按共通处理。唯一冲突只捕获相应数据库错误，其他异常不得伪装成“同名”。

测试至少1条食材/步骤、连续order、未知字段拒绝、同名含两端空白、并发同名仅1成功、事务失败不残留子数据、用户归属不可指定、响应不泄漏数据库字段。重复POST不自动幂等；客户端防连点，网络结果不确定先查询。
