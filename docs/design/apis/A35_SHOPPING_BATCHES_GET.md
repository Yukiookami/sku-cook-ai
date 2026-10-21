# A35 GET /api/shopping/batches

已实现；[S14](../screens/S14_SHOPPING_PANEL.md)恢复入口使用。仅采购绑定登录账号；空 query，不接受用户参数。

200 `ShoppingBatchesResponseSchema`：`{batches: ShoppingBatch[]}`，按创建时间/ID倒序最多20批。每批包含 payload、pending/sending/succeeded/failed/conflict 状态、errorCode/message、nullable receipt 和 createdAt。

仅返回所属用户的确认快照与安全回执，无 token、用户资料、租约或内部请求。旧批次可按[A36](A36_SHOPPING_BATCH_GET.md)读取，非绑定403、未配置503；不会从 Todo 读取购买进度。
