# A36 GET /api/shopping/batches/:id

已实现；登录及稳定账号绑定校验同[A35](A35_SHOPPING_BATCHES_GET.md)，`:id` 为 UUID，query 必须空。

200 `ShoppingBatchResponseSchema`：`{batch:ShoppingBatch}`。不存在或不属于当前账号404 `SHOPPING_BATCH_NOT_FOUND`。用于读取持久原批次，不自动调用外部发送，也不重新抓菜谱快照。
