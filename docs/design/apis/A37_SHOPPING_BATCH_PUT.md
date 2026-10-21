# A37 PUT /api/shopping/batches/:id

已实现；[S14](../screens/S14_SHOPPING_PANEL.md)确认后先保存，再显式调用A38。登录及绑定账号校验；body最多256KiB，query空。

Body `CookShoppingBatchInputSchema` 完整对应 Todo schemaVersion 1 机器输入：batchId UUID须等于路径，title 1–200字符、plannedDate有效ISO日期或null、recipes 1–50项、items 1–300项。recipeId最大128、servings32；食材名200、quantityText200、unit100；每项来源1–50，originalText最大500。菜谱/食材编号唯一，来源必须属于本批；所有对象 strict，不接受 URL/userId。

原子保存归属、完整规范化快照/hash与pending状态，200返回`{batch}`。用户行锁串行化同账号保存；同ID同内容返回原记录，不同内容409 `IDEMPOTENCY_CONFLICT`，不允许变更。首次保存校验菜谱归属；已有同内容批次可在原菜谱变化/删除后继续恢复，不以新数据替换。

无外部网络，不改厨房/历史。先持久化成功才允许[A38](A38_SHOPPING_SEND_POST.md)传输。
