# A19 GET /api/recipes/export

状态：接口与 Web 下载入口已实现；待在可用服务/数据库环境完成真实 HTTP 验收。调用画面：[S05](../screens/S05_RECIPE_IMPORT.md)。shared Contract：`RecipeExportResponseSchema`。

## 请求

无 Query、无 Body；不接受客户端 userId。响应为 `application/json` 下载，文件名 `recipes-v1.json`。

## 成功 200

响应复用现有 JSON 导入结构，字段与 RecipeInput 一致：

```json
{
  "version": 1,
  "recipes": [
    {
      "title": "番茄炒蛋",
      "servings": 2,
      "tags": ["家常菜"],
      "ingredients": [{ "name": "鸡蛋", "amount": "3", "unit": "个" }],
      "steps": [{ "order": 1, "text": "炒熟。" }]
    }
  ]
}
```

不导出数据库 ID、用户 ID、创建/更新时间、厨房菜单或做饭历史；可选空值省略，食材、步骤与标签顺序保持原样。菜谱按数据库 ID 升序，读取使用 RepeatableRead 快照。菜库为空时正常导出 `{ "version": 1, "recipes": [] }`。

## 限制与错误

导出内容使用可被 A08/A09 直接导入的 version 1 格式。最多1000道、格式化 UTF-8 JSON 不超过10 MiB；超过任一限制返回413 `PAYLOAD_TOO_LARGE`，不返回部分菜谱。导入同名规则仍适用，因此恢复到已含同名菜谱的菜库会整体校验失败，不能覆盖旧数据。

500/503使用通用错误，不返回空成功或部分数据；不记录菜谱正文。

## 测试与验收

测试 DTO 不含本地 ID/null 字段并符合导入 Contract、稳定顺序和默认用户范围、空菜库响应、1000/1001道与10MiB边界、数据库失败不伪装成空导出。Web依据HTTP响应字节显示下载进度，长度未知时用不确定进度。待真实 PostgreSQL 环境验证快照读取与下载响应。
