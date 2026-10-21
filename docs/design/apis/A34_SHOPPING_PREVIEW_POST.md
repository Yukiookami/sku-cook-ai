# A34 POST /api/shopping/preview

已实现；调用 [S14](../screens/S14_SHOPPING_PANEL.md)。仅登录且稳定用户 ID 匹配采购绑定配置时允许；未配置503，非绑定403。

请求 `ShoppingPreviewInputSchema`：`{items:[{recipeId:正整数,targetServings:1..100}]}`，1–50道、不可重复，禁止额外字段。服务端仅查询当前用户菜谱，不存在或跨用户成员整体404。

200 `ShoppingPreviewSchema`：`{recipes:[{recipeId:string,title,servings}],items:[{itemId:UUID,name,quantityText,unit,sources:[{recipeId,originalText}]}]}`。使用原食材稳定编号派生 UUID；保留原份数用量/备注与目标份数，纯数值参考换算；精确同名同单位且无备注项保守合并，近似/范围/适量不合并。空食材可预览但不能保存发送；超过300项拒绝，不截断。

只读预览，不创建 Todo、不改菜单。所有请求严格校验；详细协议和环境边界见[集成手册](../../development/TODO_INTEGRATION.md)。
