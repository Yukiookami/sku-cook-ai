# V1 共通设计与数据 Contract

状态：设计约束已确定；shared Contract 与 A02–A18 API 源码已实现，Prisma Schema 已扩展。初始版本化迁移已应用于本地Docker开发数据库，Seed连续执行两次保持一个默认用户；A01、A02、A10、A16真实HTTP只读冒烟检查通过。业务写入、事务与并发数据库集成仍未验收。

## 1. 实现边界

Vue 3 + Vant 4 + CSS，页面使用 Composition API；Axios 请求集中于 api 目录。后端 Fastify route → service → Prisma，只有确有需要才拆 controller / repository。PostgreSQL 保存数据；JSON导出由浏览器下载，导入读取文本后提交 application/json，不在服务端上传或保存文件。

所有业务归属由服务端 `DEFAULT_USER_ID` 确定，客户端不提供 userId。每次查改删都带服务端用户过滤；无登录仅限可信家庭局域网，不是公网安全方案。业务 API 返回 `Cache-Control: no-store`，Service Worker 不缓存 API。

## 2. 视觉与 AI 画图通用规则

| 项目              | 手机                                   | 厨房屏                                |
| ----------------- | -------------------------------------- | ------------------------------------- |
| 参考画板          | 390×844 CSS px                         | 竖屏 750×1000、横屏 1000×750 CSS px   |
| 背景 / 主文字     | `#FFFDF8` / `#332E28`                  | 同手机，白色便签卡片                  |
| 辅助文字          | `#716452`                              | 同手机，不作唯一状态表达              |
| 主操作            | 蜂蜜黄 `#FFE28A` 底配深棕 `#332E28` 字 | 同手机，当前菜粗边框加“当前”文字      |
| tag 浅底 / 分割线 | `#FFF4C2` / `#EADCC4`                  | 同手机，可用轻虚线                    |
| 危险色            | `#A93D3D`，同时标注“删除”              | 完成不是危险色，不依赖颜色            |
| 字号              | 正文 16px，标题 24～28px，说明 14px    | 正文 ≥20px，步骤 24～28px，菜名 ≥28px |
| 点击区域          | ≥44px；主按钮 ≥48px                    | ≥56px，按钮之间 ≥16px                 |
| 页面边距          | 20px，纵向间距 12～24px                | 24～32px，主体不能被底部按钮遮挡      |

当前设计是“奶油黄可爱Memo / 圆角便签”：白卡片16～20px圆角、内边距16～20px、按钮14px圆角，可用轻微阴影（建议 `0 4px 16px rgba(70, 50, 20, 0.06)`）、组内浅虚线、标题小色条和少量CSS波浪边；不引入贴纸/吉祥物图片、纸纹、渐变、动画、社交信息或五栏导航。正文使用清晰系统字体，标题偏圆润字重，不安装手写字体。全App一致，厨房不再强制黑白，但降低装饰占高并保留大字和按钮。所有画面均可纵向滚动；厨房每次展示当前一道菜的完整内容，不按视口分页。厨房可用菜单与明确按钮切菜，禁止以滑动手势切菜或翻页。平板与桌面访问同一个 Web，不另建 admin。

与用户参考图只共享风格特征，不复制其品牌/画面资产或“100克选择/勺子”等功能。纯文字业务不限制CSS几何装饰；提示词必须使用当前Memo规范，而不是历史V1/V2图中的陶土橙/厨房黑白。常规正文及必要辅助文字对背景至少4.5:1，浅黄按钮用深棕字，不能白字低对比。Web 已将业务画面、技术验证页与PWA主题变量统一到当前Memo奶油黄色系。

错误提示就地显示，必要时 Vant Toast 辅助，但不只用短暂 Toast 呈现字段错误。读接口失败提供重试；提交中禁用重复点击，保留输入。使用明确 loading 状态；厨房不用闪烁骨架或旋转动画。PWA 更新提示属于全局壳，不在每份设计图重复添加。

### 2.1 页面延伸与设备空间

用户补充：手机长表单和长正文无需全部挤进首屏，使用正常字号、点击区域及舒适间距自然向下滚动，固定底部操作不能遮挡最后一项。全站隐藏滚动条外观，但不禁用页面、标签栏、弹层或长内容的滚动。Android厨房平板约10寸，横屏优先食材/做法两栏；厨房当前一道菜的全部内容连续纵向滚动，不凭视口拆页、不缩字或裁内容。

全站移动端使用固定初始 viewport，禁用用户手势缩放；这是明确的交互取舍，会限制用户通过双指缩放放大页面。为避免 iOS 聚焦文本控件时自动放大，文本输入与文本域字号至少为 16px；页面正文与控件仍需保持可读。

## 3. 公共数据类型

ID 为正整数；日期为 ISO 8601 UTC 字符串。请求对象拒绝未知字段（包括图片、userId、服务端生成字段）；响应不暴露数据库模型全部字段。前端可解析响应后进行展示，原始用户文本按纯文本渲染，不使用 v-html。

### 3.1 RecipeInput

| 字段                     | 类型 / 约束                                                     |
| ------------------------ | --------------------------------------------------------------- |
| title                    | 必填 string；trim 后 1～50 字；同一用户唯一                     |
| description              | 可选 string，trim；最多 500 字                                  |
| servings                 | 原菜谱份数，1～100 正整数；省略默认 1，响应始终非 null          |
| prepMinutes、cookMinutes | 可选 0～1440 的整数；0 是合法值                                 |
| difficulty               | 可选 `easy` / `medium` / `hard`，显示简单 / 中等 / 复杂         |
| tags                     | 可选 string[]；默认 []；最多 20 项，每项 trim 后 1～20 字且去重 |
| ingredients              | 必填非空 IngredientInput[]；最多 100 项                         |
| steps                    | 必填非空 StepInput[]；最多 100 项                               |
| tips                     | 可选 string；最多 5000 字                                       |
| source                   | 可选 string；自由文本或网址，最多 500 字；不服务端抓取          |

IngredientInput：`name` 必填、trim 后1～50字；`amount` / `unit` / `note` / `group` 可选字符串，上限分别为50 / 20 / 200 / 50字。Web表单把数量与单位合为一个输入框；纯数字输入时展示可滚动的下拉联想项，如“3个”“3克”“3勺”，选择后分别存入amount和unit。非建议单位仍可直接输入，如“2枚”；“适量”“少许”“2～3”等数量原样保留。数组顺序是展示顺序；group缺失的先展示，其余分组按首次出现顺序，组内保持原顺序。数量始终是字符串。

IngredientInput 另有 `scaleWithServings` 可选 boolean，省略默认 true；响应必有 boolean。它与 servings 都不是可清空的可选标量。false 表示保留原量，适用于部分油、水、调料。旧版 version=1 导入没有这两个字段时按默认值处理，不根据文本推断原份数。

StepInput：`order` 必填正整数，`text` 必填且trim后1～5000字；数组内order必须恰好是1…N且与数组顺序相同，不重复、不跳号。前端移动条目后重新编号，服务端不默默修复非法导入。

表单可选文本留空时省略；可选数字留空时省略而不是变成0；请求可选字段不使用null。原份数输入不得留空，范围1～100；接口省略servings / scaleWithServings分别默认1 / true。PUT是完整替换，省略其他可选字段表示清除，省略这两个默认字段则重置为默认值；编辑端必须显式提交已有值。响应缺失可选标量返回null，tags返回[]，servings / scaleWithServings始终非null。上述字段长度及数量上限统一由shared约束，不能不同页面各自定义。

### 3.1.1 份数换算

用户已确认：新增默认1人份但允许原份数；手机详情及发送弹层用 − / ＋ 调整每道目标份数，并发送到厨房。目标初始等于原份数，不是所有菜一律显示1。

- targetServings 为1～100正整数；下限/上限边界禁用按钮。它是本次阅读/做饭状态，不改变Recipe.servings，也不新增单独换算API。
- trim 后 amount 仅当匹配 `^\d+(?:\.\d+)?$` 且 scaleWithServings=true 才换算。负号、科学记数、范围、分数、单位混在amount内、空值、中文量词不解析，保留原文；合法数字0仍是0。
- 比例是 targetServings / Recipe.servings，始终从保存的原量重新算，不基于上次显示值累计，以免反复 + / − 产生误差。
- 原份数等于目标时原文不改。按精确十进制计算后四舍五入到最多2位小数并去尾零；结果发生舍入时标“约”。正值舍入后为0时显示“少于0.01”，不可显示0。数值输入受50字上限约束，使用无浮点累计误差的字符串/整数计算，不为此安装数学库。
- 个/枚等不自动向上取整，允许参考“1.5个”；用户自行分配。文字量与关闭换算项在目标不同时标“原量/按需调整”。
- 全部换算区显示“参考用量，调料按口味调整”。不解析步骤或tips中的“加10g盐”，不换算时间/火力，目标不同另提示“步骤与时间沿用原菜谱”。
- 将实际共享的纯换算/格式化规则放shared，Web详情/厨房复用；API存原量及目标份数，不把临时计算量覆盖进菜谱。既有 Schema 不包含这些业务字段，实施时才新增并测试。

### 3.2 Recipe / RecipeSummary

Recipe 是规范化后的完整输入加 `id`、`createdAt`、`updatedAt`；不含 userId、密码或其他关系内部字段。RecipeSummary 只含 `id`、`title`、`description`、`servings`、`prepMinutes`、`cookMinutes`、`difficulty`、`tags`、`updatedAt`，不传食材、步骤和 tips。

总时长不单独存储：两个时间均非 null 时相加，否则不显示“总时长”。单独的准备 / 烹饪时间可在详情中显示，0 不当作缺失。

[A14随机推荐](apis/A14_RECIPE_RANDOM_GET.md)复用RecipeSummary，只返回一道候选；成功类型为 `{ recipe: RecipeSummary, reason: null }` 或 `{ recipe: null, reason: "EMPTY_LIBRARY" | "NO_ALTERNATIVE" }`，实施时用shared联合Schema约束，不用宽泛可空字段放任无效组合。Query只允许可选excludeRecipeId，不带列表筛选，推荐不持久化、不写厨房。V2外卖候选是未来独立业务，不混入RecipeInput或厨房Contract。

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
      },
      {
        "name": "盐",
        "amount": "适量",
        "unit": null,
        "note": null,
        "group": null,
        "scaleWithServings": true
      }
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

| 字段           | 说明                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| recipeIds      | 去重且有序的 0～10 个菜谱 id                                                                                                                                        |
| items          | 与 recipeIds 同序的 `{ recipeId, targetServings }[]`；服务端保存目标，recipeIds由其派生，空菜单为 []                                                                |
| activeRecipeId | 非空菜单中恰好属于 recipeIds；空菜单时 null                                                                                                                         |
| revision       | 非负整数版本。初始空状态 0（未创建会话时GET及首次expectedRevision均为0）；成功替换菜单请求总是+1，切换仅在active变化时+1，非空清空/完成+1，空清空及选中当前菜不变更 |
| updatedAt      | 变更时间；初始未创建记录时 null                                                                                                                                     |
| recipes        | 按 recipeIds 排列的完整 Recipe[] 快照；空菜单为 []                                                                                                                  |

`pollIntervalSeconds` 默认 10，由后端 `KITCHEN_POLL_INTERVAL_SECONDS` 环境变量确定（正整数，范围 5～300），不是前端 VITE 配置副本。GET 返回空状态而不是 404；GET 不创建数据库记录。发送创建第一条记录。

厨房请求串行，不叠加轮询；回来前台立即重新读。厨房本地页码不写服务端，切换菜谱才写 activeRecipeId。切换不会标记菜已做完，菜单位置也不是已完成数量；没有逐道完成打勾，[A15](apis/A15_KITCHEN_COMPLETE_POST.md)“完成”才把整份菜单记为一顿历史并清空，[A13](apis/A13_KITCHEN_DELETE.md)只清空，不记。

版本用于并发控制，不能表示“屏幕已收到”。所有写入携带 `expectedRevision`；服务端原子比对当前版本，失配返回 409 SESSION_CONFLICT。手机打开弹层读取一次版本，厨房使用最近的成功响应版本。不自动重试带旧版本的写操作，不因轮询失败清空菜谱。

显示内容比较包含 recipes 的文字、顺序、items 的目标份数与当前菜，不能只比较 recipeIds / activeRecipeId；相同响应不重置 DOM 或页码。本机写入成功后更新本地版本，下一次轮询不能重复刷新。

发送Body使用items而不重复提交recipeIds，避免两份列表矛盾。每个recipeId只出现一次，targetServings必填1～100正整数；读取/切换/清空等成功响应都包含items，原Recipe.servings与amount仍是原值。厨房按items与Recipe共同计算显示。编辑原菜谱时保留会话目标份数，使用新原份数/原量重新计算；修改和删除仍同步revision及成员关系。

### 3.4 导入

请求是 `{ "version": 1, "recipes": [RecipeInput] }`，1～1000 条，总体最多 10 MiB（10,485,760 字节，UTF-8 请求体）；不使用 multipart、Base64、Excel 或图片。文件输入检查原始字节，粘贴检查 UTF-8 字节，API 最终检查 bodyLimit。导出复用 version 1 RecipeInput 数据结构，完整导出最多1000道且格式化JSON不超过10 MiB；超限明确失败，不返回部分菜库。

预校验成功返回 `{ valid: true, count: N, issues: [] }`；业务校验失败是 422，错误报告含全部可识别的问题，前端按 index +1 显示第几条。语法错误无法继续检查条目时为 400。

正式导入返回 `{ importedCount: N, recipeIds: number[] }`；顺序与输入一致。预校验不保存草稿、不生成 token，正式提交同一份输入并重新校验。用户修改文本后旧校验状态立即失效。

### 3.5 做饭历史

CookingHistory响应为 `{ id, cookedAt, source, items }`：id正整数、cookedAt服务端记录的ISO UTC时间、source为`kitchen`/`manual`，items为1～10条有序 `{ recipeId: 正整数 | null, title: string, targetServings: 1～100正整数 }`。title是当时菜名快照，份数是当次目标；manual仅1条，kitchen为完成时全菜单。

无userId、食材步骤、内部关系id或sourceSessionRevision，不保存完整Recipe副本；菜谱删除使recipeId=null，title/份数保留。查看链接访问最新Recipe，历史目标只初始化详情的本次显示份数。列表A16每页20次 `{ items: CookingHistory[], page, pageSize, hasMore }`；手动A17返回 `{ history: CookingHistory }`；删除A18返回204。shared Schema、Prisma模型与源码已实现；初始迁移已应用于本地开发数据库，A16只读路径已通过真实HTTP冒烟，写入及事务集成尚未验收。

历史与推荐/浏览记录无关。同日同菜多次做过可多条，V1无日期补录、编辑、统计和清空全部；删除误记整组不影响Recipe或KitchenState。手机主动查看历史，不通知/轮询。

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
| 404  | COOKING_HISTORY_NOT_FOUND       | 历史不存在、已删或不属于默认用户                   |
| 409  | RECIPE_TITLE_CONFLICT           | 与现有菜名冲突                                     |
| 409  | SESSION_CONFLICT                | 厨房状态已变更，重新读取                           |
| 409  | KITCHEN_SESSION_EMPTY           | 当前为空，不能完成并创建空历史                     |
| 413  | PAYLOAD_TOO_LARGE               | 请求体超限                                         |
| 422  | IMPORT_VALIDATION_FAILED        | 导入条目、同名、版本校验未通过                     |
| 500  | INTERNAL_ERROR                  | 内部异常；服务端 Pino 记录                         |
| 503  | SERVICE_UNAVAILABLE             | 已识别的数据库不可用；日志明确，不能返回成功空列表 |

网络断开是前端请求失败，不伪造 HTTP 状态。POST / PUT / DELETE 响应丢失可能已经写入，提示“结果暂未确认，请重新查询”，不自动重复提交。厨房可以 GET 确认结果；若已空，仅显示待机而不杜撰完成通知。字段校验失败保留输入，500 / 503 不将错误当作空数据。

## 5. 数据与事务设计

Prisma Schema 已定义 Recipe（userId 外键，规范化 title 同用户唯一，servings默认1且不可空）、食材（scaleWithServings默认true）/ 步骤从属数据、KitchenSession（userId 唯一）、KitchenSessionRecipe（顺序、菜谱外键、targetServings为1～100正整数）、CookingHistory 与从属项。食材“内嵌”指业务随菜谱读写，不等于需要独立食材字典或强制使用 JSON 列。版本化迁移须在数据库环境可用后由 Prisma 工具生成和验收，当前没有迁移产物。

做饭历史再新增CookingHistory（userId、cookedAt、source、可空内部sourceSessionRevision）及从属项（顺序、可空Recipe外键、当时title、targetServings）。Recipe删除对历史项SetNull、保留名字/份数，不级联删历史；历史本身删除级联其项。厨房来源 `(userId, sourceSessionRevision)` 唯一防重复，手动null可多次；模型/约束/索引实施时通过版本化迁移建立，不在本次生成空迁移。

会话成员与 activeRecipeId 必须保持一致。替换会话、切换、清空/完成，以及影响会话的菜谱编辑 / 删除、手动历史写入，用同一用户的事务锁串行化（可锁既有默认 User 行），厨房写入事务内检查 revision；不采用“先 GET、后无条件 UPDATE”。A11每次接受替换请求均递增revision；A12同一active、A13空菜单不变revision。A15历史创建与菜单清空一个事务，不能分两次HTTP请求凑合；A13从不记历史。

- 编辑当前菜单中的菜谱也递增会话 revision，读接口在一致性事务快照内返回菜谱内容。
- 删除菜谱原子删除所属食材、步骤并移除会话成员。若删的是当前菜，选择剩余有序菜单第一道；无剩余则 activeRecipeId=null。否则保留当前菜。会话改变递增 revision。
- 新建与批量导入依靠数据库唯一约束兜底，不能只用“提交前查重”抵抗并发。
- 所有写入失败回滚，不吞掉数据库异常。集成测试使用独立测试数据库。

普通菜谱完整编辑采用最后一次成功保存为准（V1 没有协同编辑）。厨房版本保护是为防止手机 / 厨房同时操作造成菜单误清，不引入 Redis、消息队列或复杂同步框架。
