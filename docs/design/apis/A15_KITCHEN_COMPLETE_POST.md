# A15 POST /api/kitchen/session/complete

状态：源码已实现；初始迁移已应用于本地开发数据库；A15历史写入、清空与事务原子性尚未通过真实HTTP验收。调用方：[S06](../screens/S06_KITCHEN_DISPLAY.md)“完成”。新增历史后与[A13](A13_KITCHEN_DELETE.md)“清空厨房”分开：本接口同事务记录本次菜单并清空，A13只清空、不记历史。

## 请求与响应

Content-Type application/json，Body：

```json
{ "expectedRevision": 9 }
```

expectedRevision必填非负整数；不接userId、菜名、目标份数、时间或客户端历史数组。以事务中当前服务端菜单为准，最后一道/最后一页由画面控制，服务端不推断逐道烹饪进度。

成功200完整KitchenState复用[A10](A10_KITCHEN_GET.md)：session.recipeIds/items/recipes为空，session.activeRecipeId=null，revision=10，updatedAt更新。这里只返回KitchenState，历史通过A16查看；不改变A10–A13的响应形状。

## 事务与重复提交

默认用户事务锁 → 比对expectedRevision → 确认非空菜单 → 读取有序成员及最新菜名/会话目标份数 → 创建一条CookingHistory及1～10条从属项 → 移除菜单成员、active=null、revision+1 → 提交 → 返回。

历史cookedAt由服务端同次确定，source=kitchen；保存历史菜名与目标份数，不复制食材步骤、原用量或估算实际吃了多少。用户点完成表示整份菜单已做过，不是系统检测到每道做完。保留会话版本记录。

历史写入与清空任何一步失败全部回滚，不能清空成功却没有历史。与发送/编辑/删菜谱/A13清空共用同一用户锁；并发两个旧版本完成至多一个成功、至多一条历史，后者409，不将重试记成第二顿。可以在历史模型保留内部sourceSessionRevision，以 `(userId, sourceSessionRevision)` 唯一约束兜底厨房来源；手动来源为null，可多次记录。

版本相同但会话为空时409 KITCHEN_SESSION_EMPTY，不生成空历史、不宣称完成。版本失配409 SESSION_CONFLICT。用户之后重新发送并再次完成是新的做饭记录，不按菜名/日期去重。

## 错误与验证

400 INVALID_INPUT；409 SESSION_CONFLICT / KITCHEN_SESSION_EMPTY；500/503通用。错误记录标准日志，不将数据库写失败伪装成成功。

响应丢失时前端显示“完成结果暂未确认，请查看做饭历史”，GET厨房只更新当前快照；空菜单也可能来自手机清空，**不单凭空状态断言历史已保存**。不自动重复POST，不显示成功庆祝；可在手机历史核对。只有收到本次200才显示完成页，完成延时不能盖掉新菜单。

测试单/多菜完整记录、顺序/菜名/份数/来源/服务端时间、同日重复菜单是两顿、版本冲突无历史、空状态无历史、双击并发仅一次、与发送/清空/删除竞态、历史创建或清空失败均回滚、用户范围、仅返回提交后的KitchenState、无通知。历史删除不恢复菜单或允许旧版本完成再次成功。
