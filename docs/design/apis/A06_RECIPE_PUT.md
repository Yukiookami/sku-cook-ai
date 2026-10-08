# A06 PUT /api/recipes/:id

状态：待实现。调用方：[S04](../screens/S04_RECIPE_EDIT.md)。参数/响应复用A04，请求复用A05的RecipeInput。

## 请求 / 成功200

id正整数；Content-Type application/json；Body是完整RecipeInput，不是PATCH。请求示例使用 [A05](A05_RECIPE_POST.md#1-请求) 的Body。成功 `{ "recipe": Recipe }`，详见 [COMMON 3.2](../COMMON.md#32-recipe--recipesummary)；id/createdAt不变，updatedAt更新。

省略可选字段表示清除，省略tags视为[]；必填食材/步骤不能省略；null、id、userId、日期和图片字段非法。前端不能直接回传GET数据。

## 处理

校验→同用户事务锁→按id+默认用户确认存在→检查改名冲突（排除自己）→事务替换全部可编辑字段与从属数据→若在厨房菜单中递增会话revision、更新时间→返回更新后的Recipe。保持同一菜谱id和会话顺序。

V1普通编辑采用最后一次成功保存为准，没有协同合并。锁和会话revision用于让厨房获取一致新内容，而不是修改后绕过用户默认归属。

## 错误

400 INVALID_INPUT；404 RECIPE_NOT_FOUND，绝不upsert变新增；409 RECIPE_TITLE_CONFLICT；413 PAYLOAD_TOO_LARGE；500/503通用。失败事务回滚，原菜谱与厨房版本不变。

## 测试

修改所有字段、清除tips/时间、清空tags、食材删除与步骤重排、同名排除自己、跨用户404、原createdAt保持、故障回滚。菜单内更新后A10返回新文本和更高revision，菜单外更新不修改会话。
