# A11 PUT /api/kitchen/session

状态：待实现。调用方：[S07](../screens/S07_KITCHEN_PANEL.md)发送 / 明确替换菜单。shared建议 `KitchenReplaceInputSchema`，响应KitchenState复用[A10](A10_KITCHEN_GET.md)。

## 请求

Content-Type application/json：

```json
{ "recipeIds": [101, 102, 103], "expectedRevision": 7 }
```

recipeIds为1～10个不重复正整数，顺序就是展示顺序；expectedRevision非负整数。空数组用A13清空，不在这里做成功空发送。客户端不指定activeRecipeId、userId、revision或设备地址。

## 成功200 / 处理

成功返回 `{ session: KitchenSession, pollIntervalSeconds: 10 }`，完整schema和示例见[A10](A10_KITCHEN_GET.md)。新状态recipeIds按输入顺序，activeRecipeId=第一道、revision=之前版本+1，updatedAt更新，recipes为完整快照。

默认用户事务锁→初始无记录视为revision0→比对expectedRevision→校验所有id存在且属于默认用户→覆盖有序成员与当前菜→提交→返回。无记录时创建单一用户会话，数据库userId唯一。

即使同一recipeIds再次发送，接受写入后也版本+1，当前菜设第一道。若这使可见内容变化，厨房回当前菜第一页；若菜单、当前菜与正文完全一样，则只同步新版本而不重绘、不强制重置本地页码。V1不额外设计“重置阅读进度”指令。

不等待厨房轮询，不调用Fully Kiosk，不承诺已收到或屏幕已亮。提交完成与数据库持久化成功才是200。

## 错误

400 INVALID_INPUT（0/11道、重复id、非法版本）；404 RECIPE_NOT_FOUND并在issues标出无效recipeIds索引；409 SESSION_CONFLICT：“厨房菜单已变更，请重新读取后确认”，不修改现有菜单；500/503通用。

## 测试

初始expected=0、替换、顺序、当前第一道、同单重发递增、不存在/跨用户id整体拒绝、同时两次发送只一个旧版本成功、与删除/完成并发一致、事务回滚。手机请求超时后GET确认，不盲重发。
