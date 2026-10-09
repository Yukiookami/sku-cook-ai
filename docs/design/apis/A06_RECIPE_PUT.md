# A06 PUT /api/recipes/:id

状态：源码已实现；初始迁移已应用于本地开发数据库；A06写入与持久化行为尚未通过真实HTTP验收。调用方：[S04](../screens/S04_RECIPE_EDIT.md)。参数/响应复用A04，请求复用A05的RecipeInput。

## 请求 / 成功200

id正整数；Content-Type application/json；Body是完整RecipeInput，不是PATCH。请求示例使用 [A05](A05_RECIPE_POST.md#1-请求) 的Body。成功 `{ "recipe": Recipe }`，详见 [COMMON 3.2](../COMMON.md#32-recipe--recipesummary)；id/createdAt不变，updatedAt更新。

省略其他可选字段表示清除，省略tags视为[]；servings/scaleWithServings省略分别默认1/true，不清空，编辑前端必须显式提交回填值；必填食材/步骤不能省略；null、id、userId、日期和图片字段非法。前端不能直接回传GET数据，也不能拿目标份数及换算量替代原份数与amount。

## 处理

校验→同用户事务锁→按id+默认用户确认存在→检查改名冲突（排除自己）→事务替换全部可编辑字段与从属数据→若在厨房菜单中递增会话revision、更新时间→返回更新后的Recipe。保持同一菜谱id和会话顺序。

修改原servings不自动调整所提交amount；厨房成员targetServings保持，前端按新原份数/原量重新计算。所有变更同事务，失败不能留下新原量与旧revision。

V1普通编辑采用最后一次成功保存为准，没有协同合并。锁和会话revision用于让厨房获取一致新内容，而不是修改后绕过用户默认归属。

## 错误

400 INVALID_INPUT；404 RECIPE_NOT_FOUND，绝不upsert变新增；409 RECIPE_TITLE_CONFLICT；413 PAYLOAD_TOO_LARGE；500/503通用。失败事务回滚，原菜谱与厨房版本不变。

## 测试

修改所有字段、清除tips/时间、清空tags、食材删除与步骤重排、同名排除自己、跨用户404、原createdAt保持、故障回滚。菜单内更新后A10返回新文本和更高revision，菜单外更新不修改会话。
