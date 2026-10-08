# A04 GET /api/recipes/:id

状态：待实现。调用方：[S02](../screens/S02_RECIPE_DETAIL.md)、[S04](../screens/S04_RECIPE_EDIT.md)。shared建议 `RecipeIdParamsSchema` / `RecipeResponseSchema`。

## 请求与响应

id为正整数；无Body/Query/userId。`GET /api/recipes/101`。

成功200：`{ "recipe": Recipe }`，完整可复制JSON示例见 [COMMON 3.2](../COMMON.md#32-recipe--recipesummary)。返回id、菜名、所有规范化可选字段、食材、连续步骤、tags、tips、source、时间；缺失可选标量null，原servings为正整数、食材scaleWithServings为boolean，不返回数据库userId或内部关系id。读取原amount，不接收目标份数Query，不返回替代原量的计算值。

## 处理

校验id → `id + DEFAULT_USER_ID`读取 → 同一一致性读取内取关联食材/步骤 → 依保存顺序组装DTO → shared响应校验。食材原始顺序保留，画面按共通group规则展示；不要在各端生成不同顺序。

## 错误

400 INVALID_INPUT：id非整数/非正数；404 RECIPE_NOT_FOUND：不存在或属于其他用户；500 INTERNAL_ERROR；已识别数据库不可用503 SERVICE_UNAVAILABLE。404与断网/服务失败区分。

## 测试

完整字段、null默认值、0分钟、中文数量、分组和步骤顺序、非法id、跨用户404、超长合法文字。读取不修改updatedAt、不创建默认菜谱。
