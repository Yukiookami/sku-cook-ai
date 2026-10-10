# A08 POST /api/recipes/import/validate

状态：源码已实现；初始迁移已应用于本地开发数据库；A08仅做导入校验，真实HTTP行为尚未单独验收。调用方：[S05](../screens/S05_RECIPE_IMPORT.md)。shared提供宽松外层 `RecipeImportValidationRequestSchema` / 严格条目Contract与 `RecipeImportValidationResponseSchema`，服务端逐条复用RecipeInput校验。

## 请求

Content-Type application/json；Body `{ "version": 1, "recipes": [RecipeInput] }`，1～1000条、最多10MiB，字段例见 [A05](A05_RECIPE_POST.md#1-请求)。浏览器读取文件/粘贴文本后提交JSON，不上传文件对象、不存临时文件。拒绝未知字段、图片、其他version、空数组。

## 响应

全部通过200：

```json
{ "valid": true, "count": 3, "issues": [] }
```

能解析JSON但业务校验不通过422：

```json
{
  "error": {
    "code": "IMPORT_VALIDATION_FAILED",
    "message": "校验未通过，未导入任何菜谱",
    "issues": [
      { "path": ["recipes", 1, "title"], "message": "已有同名菜谱" },
      { "path": ["recipes", 2, "steps", 0, "text"], "message": "请填写步骤描述" }
    ]
  }
}
```

version错误路径为["version"]。数组索引0-based，报告中显示第2、第3道。可识别的问题全部返回，不只第一个。

## 处理

请求字节限制→JSON解析→共享schema safeParse收集字段问题→对有合法title的条目检查文件内重名、当前默认用户已有title→合并报告。即使某条食材非法，其合法菜名仍可查重；不能因第一条错就不给剩余条目报告。

去除两端空白后查重，与新增/编辑一致。此API只读，不写菜谱、会话或校验token，不保证此刻通过之后仍无冲突。

version=1继续接受省略servings/scaleWithServings的文件，分别默认1/true；显式非法份数/非boolean定位相应字段。原2/4人份食材无需转换成1人份，文字量不改。该默认规则与A05/A09复用，不凭文本推断份数。

## 其他错误与测试

400 INVALID_REQUEST：畸形JSON；413 PAYLOAD_TOO_LARGE；500/503通用（数据库失败不能说valid=true或已有同名）。422包含结构、字段、version、同文件同名和库中同名错误。

测试1/1000/1001条、空recipes、10MiB边界、中文UTF-8、全部字段定位、同文件trim重名、用户隔离、校验后数据库完全不变。正式导入使用相同规则。
