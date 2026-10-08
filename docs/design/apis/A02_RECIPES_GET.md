# A02 GET /api/recipes

状态：待实现。调用方：[S01](../screens/S01_RECIPE_LIST.md)、导入后返回列表。请求响应类型见 [COMMON](../COMMON.md)；建议 shared `RecipeListQuerySchema` / `RecipeListResponseSchema`。

## 1. 请求

| Query    | 规则                                               |
| -------- | -------------------------------------------------- |
| page     | 正整数，默认1                                      |
| pageSize | 默认20，1～20                                      |
| q        | 可选，trim后的菜名搜索词，最长50字；空串视为无搜索 |
| tag      | 可选，trim后单个tag；空串无筛选，最长20字          |

无Body，不接userId。q只匹配title，采用不区分大小写的字面子串匹配，不解释为正则或SQL通配语法；`%`、`_`应作为字面字符正确转义。tag精确匹配归一化标签，不搜步骤/食材。

示例：`GET /api/recipes?page=1&pageSize=20&q=番茄&tag=家常菜`

## 2. 成功200

```json
{
  "items": [
    {
      "id": 101,
      "title": "番茄炒蛋",
      "description": "十分钟家常菜",
      "servings": 2,
      "prepMinutes": 5,
      "cookMinutes": 10,
      "difficulty": "easy",
      "tags": ["家常菜", "快手"],
      "updatedAt": "2026-10-08T05:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "hasMore": false
}
```

items为RecipeSummary[]，不带正文；servings为原菜谱正整数且非null，供多选发送初始化目标份数，不是当前厨房份数。零结果正常200、items=[]、hasMore=false；超出末页同样为空。不默认计算总数。

## 3. 处理与存储

校验Query → 服务端默认用户过滤 → q与tag AND组合 → `updatedAt DESC, id DESC`稳定排序 → skip `(page-1)*pageSize`、take `pageSize+1` →多余一条决定hasMore，再返回pageSize以内条数。家庭百级数据先用简单分页，不虚拟滚动、全文搜索或游标框架。

分页不是跨请求数据库快照；在新增/编辑/删除后客户端重置第一页，不把新旧排序拼接。数据库失败不能返回空成功。

## 4. 错误与测试

400 INVALID_INPUT（page=0、非整数、pageSize>20、过长查询）；500 INTERNAL_ERROR；已识别数据库不可用503 SERVICE_UNAVAILABLE。使用共通错误，不暴露SQL。

测试：0/20/21/40/41条，排序时间相同按id区分，空结果与末页，q+tag组合，中文和特殊字符，默认用户隔离，失败非空成功。
