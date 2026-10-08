# A10 GET /api/kitchen/session

状态：待实现。调用方：[S06](../screens/S06_KITCHEN_DISPLAY.md)串行轮询、[S07](../screens/S07_KITCHEN_PANEL.md)打开时读一次。shared建议 `KitchenStateResponseSchema`。

## 请求 / 成功200

无Body、Query、userId或设备id；不需要配对。非空响应结构：

```json
{
  "session": {
    "recipeIds": [101],
    "items": [{ "recipeId": 101, "targetServings": 3 }],
    "activeRecipeId": 101,
    "revision": 7,
    "updatedAt": "2026-10-08T05:10:00.000Z",
    "recipes": [
      {
        "id": 101,
        "title": "番茄炒蛋",
        "description": "十分钟家常菜",
        "servings": 2,
        "prepMinutes": 5,
        "cookMinutes": 10,
        "difficulty": "easy",
        "tags": ["家常菜", "快手"],
        "ingredients": [
          {
            "name": "鸡蛋",
            "amount": "3",
            "unit": "个",
            "note": null,
            "group": null,
            "scaleWithServings": true
          },
          {
            "name": "番茄",
            "amount": "2",
            "unit": "个",
            "note": "切块",
            "group": null,
            "scaleWithServings": true
          }
        ],
        "steps": [{ "order": 1, "text": "鸡蛋打散，炒熟后与炒软的番茄翻匀。" }],
        "tips": null,
        "source": null,
        "createdAt": "2026-10-08T05:00:00.000Z",
        "updatedAt": "2026-10-08T05:00:00.000Z"
      }
    ]
  },
  "pollIntervalSeconds": 10
}
```

尚未创建会话也200：

```json
{
  "session": {
    "recipeIds": [],
    "items": [],
    "activeRecipeId": null,
    "revision": 0,
    "updatedAt": null,
    "recipes": []
  },
  "pollIntervalSeconds": 10
}
```

曾清空的会话保留已增长revision与非null updatedAt，不重置为0。

items与recipeIds、recipes一一同序对应，各成员携带已发送的targetServings。示例是原2人份、目标3人份：响应amount仍为鸡蛋3个/番茄2个，前端计算显示4.5个/3个。不能把换算后的量写入Recipe或在重读时再乘一次。

## 处理

默认用户范围→一致性事务快照读取会话、排序成员和完整菜谱→构造KitchenState→返回Cache-Control:no-store。快照需确保版本与内容同一时点（例如repeatable-read读取），不能分开读得到新成员配旧版本。GET不写数据、不设置当前菜。

份数同属该快照；菜单内菜谱编辑后原份数/食材取最新值，但targetServings保持原发送值。份数缺失或不合法属于数据不变量错误，不静默填1来掩盖问题。

10秒仅前台轮询目标；接口不推送、唤醒或确认设备在线。pollIntervalSeconds来自后端配置，无需另开配置API。携带菜谱正文是为了10道以内的一次请求完整更新，不引入Redis/SSE。

## 错误与测试

500/503通用；缺失会话不是404，数据库失败不是空菜单。数据不变量破坏应日志+错误而不是静默过滤缺失菜谱。

测试初始空、清空后的版本、完整正文顺序、编辑菜谱后版本与文本更新、同一快照、用户隔离、Cache-Control、不修改updatedAt、配置间隔。手机不循环调用，厨房重复相同内容不重绘。

测试目标与原份数独立、重开GET保留目标、原amount无变、空items、编辑基准份数后目标保持。
