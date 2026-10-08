# V1 共通设计与数据 Contract

状态：业务设计初稿。除 health 外，以下 Contract 尚未写入代码；实现时先建立 shared Zod Schema 与测试，再接 API / 页面。现有错误处理只有基础能力，业务错误码需在实现对应功能时接入，不能直接假设已有。

## 1. 实现边界

Vue 3 + Vant 4 + CSS，页面使用 Composition API；Axios 请求集中于 api 目录。后端 Fastify route → service → Prisma，只有确有需要才拆 controller / repository。PostgreSQL 保存数据；V1 不上传或保存文件，JSON 导入读取文本后提交 application/json。

所有业务归属由服务端 `DEFAULT_USER_ID` 确定，客户端不提供 userId。每次查改删都带服务端用户过滤；无登录仅限可信家庭局域网，不是公网安全方案。业务 API 返回 `Cache-Control: no-store`，Service Worker 不缓存 API。

## 2. 视觉与 AI 画图通用规则

| 项目              | 手机                                | 厨房屏                                |
| ----------------- | ----------------------------------- | ------------------------------------- |
| 参考画板          | 390×844 CSS px                      | 竖屏 750×1000、横屏 1000×750 CSS px   |
| 背景 / 主文字     | `#FDFCFA` / `#1F1F1F`               | `#FFFFFF` / `#111111`                 |
| 辅助文字          | `#6B6B6B`                           | 清晰的深灰，不作唯一状态表达          |
| 主操作            | 陶土橙 `#B8502D` 底白字             | 黑底白字                              |
| tag 浅底 / 分割线 | `#F6E7E0` / `#E5E2DD`               | 黑白边框、文字标注当前项              |
| 危险色            | `#A83232`，同时标注“删除”           | 完成不是危险色，不依赖颜色            |
| 字号              | 正文 16px，标题 24～28px，说明 14px | 正文 ≥20px，步骤 24～28px，菜名 ≥28px |
| 点击区域          | ≥44px；主按钮 ≥48px                 | ≥56px，按钮之间 ≥16px                 |
| 页面边距          | 20px，纵向间距 12～24px             | 24～32px，主体不能被底部按钮遮挡      |

纸质菜谱书 / 高对比极简，不用图片、封面占位图、渐变、重阴影、装饰插画、社交信息或底部五栏导航。标题可用系统宋体 / 衬线字体，正文系统无衬线，不新增 Web 字体依赖。普通页面可纵向滚动；只有厨房页按可见空间分页，禁止滑动手势导航。平板与桌面访问同一个 Web，不另建 admin。

错误提示就地显示，必要时 Vant Toast 辅助，但不只用短暂 Toast 呈现字段错误。读接口失败提供重试；提交中禁用重复点击，保留输入。使用明确 loading 状态；厨房不用闪烁骨架或旋转动画。PWA 更新提示属于全局壳，不在每份设计图重复添加。

## 3. 公共数据类型

ID 为正整数；日期为 ISO 8601 UTC 字符串。请求对象拒绝未知字段（包括图片、userId、服务端生成字段）；响应不暴露数据库模型全部字段。前端可解析响应后进行展示，原始用户文本按纯文本渲染，不使用 v-html。

### 3.1 RecipeInput

| 字段                     | 类型 / 约束                                                                |
| ------------------------ | -------------------------------------------------------------------------- |
| title                    | 必填 string；trim 后 1～50 字；同一用户唯一                                |
| description              | 可选 string，trim；建议上限 500 字                                         |
| servings                 | 可选正整数；建议最大 100                                                   |
| prepMinutes、cookMinutes | 可选非负整数；建议各最大 1440；0 是合法值                                  |
| difficulty               | 可选 `easy` / `medium` / `hard`，显示简单 / 中等 / 复杂                    |
| tags                     | 可选 string[]；默认 []；每项 trim 后非空、去重；建议最多 20 项，每项 20 字 |
| ingredients              | 必填非空 IngredientInput[]；建议最多 100 项                                |
| steps                    | 必填非空 StepInput[]；建议最多 100 项                                      |
| tips                     | 可选 string；建议上限 5000 字                                              |
| source                   | 可选 string；自由文本或网址，建议上限 500 字；不服务端抓取                 |

IngredientInput：`name` 必填非空字符串（建议 50 字），`amount` / `unit` / `note` / `group` 可选字符串（建议上限分别 50 / 20 / 200 / 50 字）。数组顺序是展示顺序；group 缺失的先展示，其余分组按首次出现顺序，组内保持原顺序。数量始终是字符串，支持“适量”“少许”“2～3”。

StepInput：`order` 必填正整数，`text` 必填 trim 后非空字符串（建议最多 5000 字）；数组内 order 必须恰好是 1…N 且与数组顺序相同，不重复、不跳号。前端移动条目后重新编号，服务端不默默修复非法导入。

表单可选文本留空时省略；可选数字留空时省略而不是变成 0；请求可选字段不使用 null。PUT 是完整替换，省略可选字段表示清除。响应统一把缺失可选标量返回 null，tags 返回 []；IngredientInput 的可选标量在响应中同样为 null。以上“建议”数值是设计初稿的输入上限，实施前统一固化到 shared，不能不同页面各自定义。

### 3.2 Recipe / RecipeSummary

Recipe 是规范化后的完整输入加 `id`、`createdAt`、`updatedAt`；不含 userId、密码或其他关系内部字段。RecipeSummary 只含 `id`、`title`、`description`、`servings`、`prepMinutes`、`cookMinutes`、`difficulty`、`tags`、`updatedAt`，不传食材、步骤和 tips。

总时长不单独存储：两个时间均非 null 时相加，否则不显示“总时长”。单独的准备 / 烹饪时间可在详情中显示，0 不当作缺失。

以下作为 A04 / A05 / A06 的完整响应示例（不是预置数据库数据）：

```json
{
  "recipe": {
    "id": 101,
    "title": "番茄炒蛋",
    "description": "十分钟家常菜",
    "servings": 2,
    "prepMinutes": 5,
    "cookMinutes": 10,
    "difficulty": "easy",
    "tags": ["家常菜", "快手"],
    "ingredients": [
      { "name": "鸡蛋", "amount": "3", "unit": "个", "note": null, "group": null },
      { "name": "番茄", "amount": "2", "unit": "个", "note": "切块", "group": null },
      { "name": "盐", "amount": "适量", "unit": null, "note": null, "group": null }
    ],
    "steps": [
      { "order": 1, "text": "鸡蛋打散，加少许盐。" },
      { "order": 2, "text": "热油下蛋液，凝固后盛出。" },
      { "order": 3, "text": "下番茄炒出汁，倒回鸡蛋翻匀。" }
    ],
    "tips": "番茄先用开水烫一下更容易去皮。",
    "source": null,
    "createdAt": "2026-10-08T05:00:00.000Z",
    "updatedAt": "2026-10-08T05:00:00.000Z"
  }
}
```

### 3.3 KitchenState

所有厨房读写成功统一返回 `{ session: KitchenSession, pollIntervalSeconds: number }`。KitchenSession：

| 字段           | 说明                                               |
| -------------- | -------------------------------------------------- |
| recipeIds      | 去重且有序的 0～10 个菜谱 id                       |
| activeRecipeId | 非空菜单中恰好属于 recipeIds；空菜单时 null        |
| revision       | 非负整数版本。初始空状态 0；每次实际内容变更 +1    |
| updatedAt      | 变更时间；初始未创建记录时 null                    |
| recipes        | 按 recipeIds 排列的完整 Recipe[] 快照；空菜单为 [] |

`pollIntervalSeconds` 默认 10，由后端 `KITCHEN_POLL_INTERVAL_SECONDS` 环境变量确定（正整数，建议 5～300），不是前端 VITE 配置副本。GET 返回空状态而不是 404；GET 不创建数据库记录。发送创建第一条记录。

厨房请求串行，不叠加轮询；回来前台立即重新读。厨房本地页码不写服务端，切换菜谱才写 activeRecipeId。切换不会标记菜已做完，菜单位置也不是已完成数量；没有逐道完成历史。

版本用于并发控制，不能表示“屏幕已收到”。所有写入携带 `expectedRevision`；服务端原子比对当前版本，失配返回 409 SESSION_CONFLICT。手机打开弹层读取一次版本，厨房使用最近的成功响应版本。不自动重试带旧版本的写操作，不因轮询失败清空菜谱。

显示内容比較包含 recipes 的文字、顺序与当前菜，不能只比较 recipeIds / activeRecipeId；相同响应不重置 DOM 或页码。本机写入成功后更新本地版本，下一次轮询不能重复刷新。

### 3.4 导入

请求是 `{ "version": 1, "recipes": [RecipeInput] }`，1～100 条，总体最多 1 MiB（1,048,576 字节，UTF-8 请求体）；不使用 multipart、Base64、Excel 或图片。文件输入检查原始字节，粘贴检查 UTF-8 字节，API 最终检查 bodyLimit。

预校验成功返回 `{ valid: true, count: N, issues: [] }`；业务校验失败是 422，错误报告含全部可识别的问题，前端按 index +1 显示第几条。语法错误无法继续检查条目时为 400。

正式导入返回 `{ importedCount: N, recipeIds: number[] }`；顺序与输入一致。预校验不保存草稿、不生成 token，正式提交同一份输入并重新校验。用户修改文本后旧校验状态立即失效。

## 4. 错误约定

延续已有错误 envelope：

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "请求参数不正确",
    "issues": [{ "path": ["ingredients", 0, "name"], "message": "请填写食材名" }]
  }
}
```

issues 可选；至少保证 path（string / number 数组）和 message。导入错误 path 从 `recipes` 开始，数组索引为 0-based；前端转换人类可读的 1-based 条目。不显示堆栈、SQL、数据库 URL、内部授权信息。现有 Zod issues 的额外字段不作为页面必需依赖。

| HTTP | code                            | 使用                                               |
| ---- | ------------------------------- | -------------------------------------------------- |
| 400  | INVALID_INPUT / INVALID_REQUEST | 参数不合法 / JSON 语法不合法                       |
| 404  | RECIPE_NOT_FOUND                | 菜谱不存在或不属于默认用户                         |
| 409  | RECIPE_TITLE_CONFLICT           | 与现有菜名冲突                                     |
| 409  | SESSION_CONFLICT                | 厨房状态已变更，重新读取                           |
| 413  | PAYLOAD_TOO_LARGE               | 请求体超限                                         |
| 422  | IMPORT_VALIDATION_FAILED        | 导入条目、同名、版本校验未通过                     |
| 500  | INTERNAL_ERROR                  | 内部异常；服务端 Pino 记录                         |
| 503  | SERVICE_UNAVAILABLE             | 已识别的数据库不可用；日志明确，不能返回成功空列表 |

网络断开是前端请求失败，不伪造 HTTP 状态。POST / PUT / DELETE 响应丢失可能已经写入，提示“结果暂未确认，请重新查询”，不自动重复提交。厨房可以 GET 确认结果；若已空，仅显示待机而不杜撰完成通知。字段校验失败保留输入，500 / 503 不将错误当作空数据。

## 5. 数据与事务设计

设计新增 Recipe（userId 外键，规范化 title 同用户唯一）、食材 / 步骤从属数据、KitchenSession（userId 唯一）、KitchenSessionRecipe（顺序与菜谱外键）等模型；最终 Prisma 表结构在业务实施时建立。食材“内嵌”指业务随菜谱读写，不等于需要独立食材字典或强制使用 JSON 列。

会话成员与 activeRecipeId 必须保持一致。替换会话、切换、清空，以及影响会话的菜谱编辑 / 删除，用同一用户的事务锁串行化（可锁既有默认 User 行），事务内检查 revision；不采用“先 GET、后无条件 UPDATE”。

- 编辑当前菜单中的菜谱也递增会话 revision，读接口在一致性事务快照内返回菜谱内容。
- 删除菜谱原子删除所属食材、步骤并移除会话成员。若删的是当前菜，选择剩余有序菜单第一道；无剩余则 activeRecipeId=null。否则保留当前菜。会话改变递增 revision。
- 新建与批量导入依靠数据库唯一约束兜底，不能只用“提交前查重”抵抗并发。
- 所有写入失败回滚，不吞掉数据库异常。集成测试使用独立测试数据库。

普通菜谱完整编辑采用最后一次成功保存为准（V1 没有协同编辑）。厨房版本保护是为防止手机 / 厨房同时操作造成菜单误清，不引入 Redis、消息队列或复杂同步框架。
