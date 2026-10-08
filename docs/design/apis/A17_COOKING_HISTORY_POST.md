# A17 POST /api/cooking-history

状态：待实现。调用方：[S02](../screens/S02_RECIPE_DETAIL.md)“记录做过”确认。预定 shared `CookingHistoryInputSchema` / `CookingHistoryResponseSchema`，复用COMMON历史类型。仅手动记录一道，不批量传菜单、不操控厨房完成。

## 请求 / 成功201

Content-Type application/json：

```json
{ "recipeId": 101, "targetServings": 3 }
```

recipeId、targetServings均必填正整数，份数上限与COMMON一致；不接title、cookedAt、source、userId或食材步骤。服务端设source=manual，取当前同用户菜名，以服务端当前时间记录，不支持V1回填过去日期。

```json
{
  "history": {
    "id": 502,
    "cookedAt": "2026-10-08T09:40:00.000Z",
    "source": "manual",
    "items": [{ "recipeId": 101, "title": "番茄炒蛋", "targetServings": 3 }]
  }
}
```

## 处理与边界

shared校验 → 默认用户事务锁 → 确认菜谱仍属于用户 → 读取菜名 → 事务创建一条CookingHistory及单个从属项 → 返回规范化历史。与删菜谱序列化，避免无依据的外键/名称写入；历史和项不能部分保存。

不更新Recipe份数/用量/updatedAt、不发送或清空厨房。相同菜同一天允许真正做多次，不以recipeId+日期去重；本接口与既有新增API一样不提供幂等token，每次成功POST代表一次手动记录。前端确认/防连点，不自动重试响应不明的请求，提示先查历史，误记可以删除。

## 错误与测试

400 INVALID_INPUT；404 RECIPE_NOT_FOUND（不存在/其他用户，不创建）；500/503通用。未知输入拒绝，失败回滚，无成功形状兜底。

测试合法/非法份数和id、菜名/来源/时间由服务端、只能单道、同日合法重复、默认用户/跨用户404、与菜谱删除竞态、事务故障、菜谱/厨房不变。确认后请求超时显示结果待确认、不自动再记。
