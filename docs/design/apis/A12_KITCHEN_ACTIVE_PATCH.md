# A12 PATCH /api/kitchen/session/active

状态：待实现。调用方：[S06](../screens/S06_KITCHEN_DISPLAY.md)菜单直接点选、跨菜上一页/下一道；本菜页码变化不调用。

## 请求 / 成功200

Content-Type application/json：

```json
{ "activeRecipeId": 102, "expectedRevision": 8 }
```

activeRecipeId必填正整数，expectedRevision必填非负整数；不接本地pageIndex、食材页、步骤完成、userId。

成功KitchenState完整结构复用[A10](A10_KITCHEN_GET.md)。仅active变更时revision+1与更新时间，recipeIds顺序保持。若选中已经当前的菜，在版本相符时200返回原状态，不递增、不重置阅读。

## 处理与错误

默认用户事务锁→版本比对→确认非空会话且activeRecipeId属于其中→修改当前菜→完整一致状态返回。

- 400 INVALID_INPUT：字段不合法或选中的菜不属于当前菜单；issues定位activeRecipeId。不存在的id也不去其他用户库探测。
- 409 SESSION_CONFLICT：状态已更新，先拒绝旧版本，再让前端重读；不自动把不在菜单的菜追加进去。
- 500/503通用；初始空会话对expected=0切换仍是400“不存在可切换的菜单”，非空菜单已被清空旧版本则409。

## 测试

换菜、选同一道无修改、非法成员、空会话、旧版本、跨菜上一页、连续快速点选、同时手机替换。切换只是查看状态，不记录做完一道、不通知手机；前端写成功才切画面，失败保留旧内容。
