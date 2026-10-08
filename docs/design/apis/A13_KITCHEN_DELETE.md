# A13 DELETE /api/kitchen/session

状态：待实现。调用方：[S07](../screens/S07_KITCHEN_PANEL.md)“清空厨房”。只取消当前菜单，无通知、不生成做饭历史；厨房“完成”改用[A15](A15_KITCHEN_COMPLETE_POST.md)，二者不再共用此操作。

## 请求

Content-Type application/json；Body：

```json
{ "expectedRevision": 9 }
```

expectedRevision非负整数。Axios DELETE使用 `{ data: { expectedRevision } }` 发送请求体，服务端必须按Body校验；不能漏传变成无条件删除。

## 成功200

不是204：返回清空后的KitchenState让屏幕更新版本：

```json
{
  "session": {
    "recipeIds": [],
    "items": [],
    "activeRecipeId": null,
    "revision": 10,
    "updatedAt": "2026-10-08T05:30:00.000Z",
    "recipes": []
  },
  "pollIntervalSeconds": 10
}
```

清空已有空菜单且版本匹配时不递增，返回原空状态；初始未创建会话expected=0返回初始空状态、不写记录。空状态具体形状见[A10](A10_KITCHEN_GET.md)。

## 处理

默认用户事务锁→比较revision→非空则移除菜单成员及其目标份数、active=null、revision+1→保留会话记录→提交返回。此处DELETE清的是菜单内容，不删除版本记录，防止版本重置导致旧请求重新匹配。

不删除Recipe或食材步骤，不新增或删除CookingHistory。它不是做完的证明，不能创建历史或把现有历史改成完成。服务端不知道本地页码。

手机清空后厨房下一次读取空状态仅待机，不显示“今天的菜做完了”或“已记历史”，手机不收到厨房提示。完成页与延时竞态属于A15/S06。

## 错误与测试

400 INVALID_INPUT（缺版本等）；409 SESSION_CONFLICT（旧清空拒绝，GET后再操作）；500/503通用。失败不清本地页，不显示成功；响应丢失GET确认，不能自动重复清新菜单。

测试单道/多道菜单清空、初始空与重复空、保留Recipe/现有历史、不创建新历史、保留版本、与新菜单/A15完成竞态、故障回滚、请求Body解析。此接口不发任何手机通知。
