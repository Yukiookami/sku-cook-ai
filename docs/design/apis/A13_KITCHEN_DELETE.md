# A13 DELETE /api/kitchen/session

状态：待实现。调用方：[S06](../screens/S06_KITCHEN_DISPLAY.md)“完成”、[S07](../screens/S07_KITCHEN_PANEL.md)“清空厨房”；两种入口共用同一清空操作，无通知和历史记录。

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

默认用户事务锁→比较revision→非空则移除菜单成员、active=null、revision+1→保留会话记录→提交返回。此处DELETE清的是菜单内容，不删除版本记录，防止版本重置导致旧请求重新匹配。

不删除Recipe或食材步骤；不添加完成状态、做菜统计或逐道完成记录。服务端不知道本地页码，也不验证“最后一页”；画面负责显示完成按钮，用户决定全部结束。

厨房主动完成成功后本地显示完成文案3秒；手机清空/轮询发现空仅待机。手机不收到提示。若刚清空后又收到新菜单，本地完成延时不能把新菜单盖回待机。

## 错误与测试

400 INVALID_INPUT（缺版本等）；409 SESSION_CONFLICT（旧完成/旧清空拒绝，GET后再操作）；500/503通用。失败不清本地页，不显示成功完成；响应丢失GET确认，不能自动重复清新菜单。

测试单道/多道完成、手机清空、初始空与重复空、保留Recipe、保留版本、旧屏与新菜单竞态、故障回滚、请求Body解析、完成延时期间新菜单。此接口不发任何手机通知。
