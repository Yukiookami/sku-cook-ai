# 吃什么饭 · V1 设计书索引

状态：2026-10-10。S00–S08 的 Web 画面与交互框架已实现并接入shared Contract/API clients；A02–A19 API 源码及Prisma Schema已实现。初始版本化迁移已应用于本地Docker开发数据库，Seed幂等性验证通过；A01、A02、A10、A16真实HTTP只读冒烟检查通过。写入事务与完整数据库集成、浏览器图稿对照及Android真机验收仍待完成。

依据：[需求文档](../requirements/REQUIREMENTS_V1.md)、[技术栈](../architecture/TECH_STACK.md)、[目录规划](../architecture/PROJECT_STRUCTURE.md)。需求定义范围，设计书细化交互与接口，实施时在 shared 中建立相应 Zod Contract。设计不新增登录、图片、AI Runtime、通知、离线写入或 TodoList。

## 1. 画面设计书

S03/S04共用表单已按实际职责拆分为基本信息、标签选择、单条食材与步骤编辑组件；联想输入复用AutocompleteInput，纯草稿/Contract映射放在Web的domain/recipe-form模块。RecipeForm保留API读取、校验与提交流程，子组件不依赖服务端或自行请求API；拆分不改变shared Contract和路由。

每个路由页面独立一份；共用厨房弹层另外单列，避免在列表和详情里重复定义。

| 编号 | 画面                                                    | 路由 / 形态                                  | 状态               |
| ---- | ------------------------------------------------------- | -------------------------------------------- | ------------------ |
| S00  | [基础首页](screens/S00_HOME.md)                         | `/health-check`；`/` 导向正式入口 `/recipes` | 前端已有技术验证页 |
| S01  | [菜谱一览](screens/S01_RECIPE_LIST.md)                  | `/recipes`                                   | 前端已实现，待联调 |
| S02  | [菜谱详情](screens/S02_RECIPE_DETAIL.md)                | `/recipes/:id`                               | 前端已实现，待联调 |
| S03  | [新增菜谱](screens/S03_RECIPE_CREATE.md)                | `/recipes/new`                               | 前端已实现，待联调 |
| S04  | [编辑菜谱](screens/S04_RECIPE_EDIT.md)                  | `/recipes/:id/edit`                          | 前端已实现，待联调 |
| S05  | [菜谱导入 / 导出](screens/S05_RECIPE_IMPORT.md)         | `/recipes/import`                            | 前端已实现，待联调 |
| S06  | [厨房显示](screens/S06_KITCHEN_DISPLAY.md)              | `/kitchen`                                   | 前端已实现，待联调 |
| S07  | [发送 / 查看厨房菜单弹层](screens/S07_KITCHEN_PANEL.md) | S01 / S02 共用，不增加路由                   | 前端已实现，待联调 |
| S08  | [做饭历史](screens/S08_COOKING_HISTORY.md)              | `/cooking-history`                           | 前端已实现，待联调 |

静态路径 `new`、`import` 与 id 路由明确区分；详情 id 只能是正整数。不存在的前端路由显示简洁的“页面不存在 / 返回菜谱”状态，不另外设计业务页面。

## 2. API 设计书

一次请求的方法与路径对应一份设计书。请求前缀统一为 `/api`。

| 编号 | 接口                                                                    | 调用画面             | 状态                     |
| ---- | ----------------------------------------------------------------------- | -------------------- | ------------------------ |
| A01  | [GET /api/health](apis/A01_HEALTH_GET.md)                               | S00                  | 已实现                   |
| A02  | [GET /api/recipes](apis/A02_RECIPES_GET.md)                             | S01、S05             | 源码已实现，待数据库验收 |
| A03  | [GET /api/recipes/tags](apis/A03_RECIPE_TAGS_GET.md)                    | S01、表单建议项      | 源码已实现，待数据库验收 |
| A04  | [GET /api/recipes/:id](apis/A04_RECIPE_GET.md)                          | S02、S04             | 源码已实现，待数据库验收 |
| A05  | [POST /api/recipes](apis/A05_RECIPE_POST.md)                            | S03                  | 源码已实现，待数据库验收 |
| A06  | [PUT /api/recipes/:id](apis/A06_RECIPE_PUT.md)                          | S04                  | 源码已实现，待数据库验收 |
| A07  | [DELETE /api/recipes/:id](apis/A07_RECIPE_DELETE.md)                    | S02                  | 源码已实现，待数据库验收 |
| A08  | [POST /api/recipes/import/validate](apis/A08_IMPORT_VALIDATE_POST.md)   | S05                  | 源码已实现，待数据库验收 |
| A09  | [POST /api/recipes/import](apis/A09_IMPORT_POST.md)                     | S05                  | 源码已实现，待数据库验收 |
| A10  | [GET /api/kitchen/session](apis/A10_KITCHEN_GET.md)                     | S06、S07             | 源码已实现，待数据库验收 |
| A11  | [PUT /api/kitchen/session](apis/A11_KITCHEN_PUT.md)                     | S07 发送菜单         | 源码已实现，待数据库验收 |
| A12  | [PATCH /api/kitchen/session/active](apis/A12_KITCHEN_ACTIVE_PATCH.md)   | S06 切换菜谱         | 源码已实现，待数据库验收 |
| A13  | [DELETE /api/kitchen/session](apis/A13_KITCHEN_DELETE.md)               | S07 清空，不记历史   | 源码已实现，待数据库验收 |
| A14  | [GET /api/recipes/random](apis/A14_RECIPE_RANDOM_GET.md)                | S01 随机推荐、换一个 | 源码已实现，待数据库验收 |
| A15  | [POST /api/kitchen/session/complete](apis/A15_KITCHEN_COMPLETE_POST.md) | S06 完成并记整顿历史 | 源码已实现，待数据库验收 |
| A16  | [GET /api/cooking-history](apis/A16_COOKING_HISTORY_GET.md)             | S08 历史分页         | 源码已实现，待数据库验收 |
| A17  | [POST /api/cooking-history](apis/A17_COOKING_HISTORY_POST.md)           | S02 手动记录做过     | 源码已实现，待数据库验收 |
| A18  | [DELETE /api/cooking-history/:id](apis/A18_COOKING_HISTORY_DELETE.md)   | S08 删除整次误记     | 源码已实现，待数据库验收 |
| A19  | [GET /api/recipes/export](apis/A19_RECIPE_EXPORT_GET.md)                | S05 菜库迁移导出     | 源码已实现，待数据库验收 |

菜谱静态API路径 `tags` / `random` 与 `:id` 正整数路由明确区分，不能因新增随机入口破坏详情访问。随机区复用S01，不新增独立路由页面。

### 2.1 Web 已引用的 shared Contract

`apps/web/src/api/*` 和 `RecipeForm.vue` 已按设计直接消费 shared Schema / 推导类型，没有在 View 重写请求 DTO。以下 Contract 已由 shared 入口导出；Web 类型检查/构建应由后端实现验证：

| 用途                       | 预期导出                                                                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 菜谱表单、详情与摘要       | `RecipeInputSchema` / `RecipeInput`、`Recipe`、`RecipeSummary`、`RecipeResponseSchema`                                                                                                                                                                              |
| 列表、标签、路由参数、份数 | `RecipeListQuerySchema` / `RecipeListQuery`、`RecipeListResponseSchema` / `RecipeListResponse`、`RecipeTagsResponseSchema` / `RecipeTagsResponse`、`RecipeIdParamsSchema`、`TargetServingsSchema`                                                                   |
| 随机推荐                   | `RecipeRandomQuerySchema`、`RecipeRandomResponseSchema` / `RecipeRandomResponse`                                                                                                                                                                                    |
| JSON 导入 / 导出           | `RecipeImportValidationRequestSchema` / `RecipeImportValidationRequest`、`RecipeImportInputSchema` / `RecipeImportInput`、`RecipeExportResponseSchema` / `RecipeExportResponse`、`RECIPE_IMPORT_MAX_RECIPES` / `RECIPE_IMPORT_MAX_BYTES`、导入校验/写入响应Contract |
| 厨房                       | `KitchenStateResponseSchema` / `KitchenStateResponse`、`KitchenReplaceInputSchema` / `KitchenReplaceInput`、`KitchenActiveInputSchema` / `KitchenActiveInput`、`KitchenRevisionInputSchema` / `KitchenRevisionInput`                                                |
| 做饭历史                   | `CookingHistoryInputSchema` / `CookingHistoryInput`、`CookingHistoryListQuerySchema`、`CookingHistoryListResponseSchema` / `CookingHistoryListResponse`、`CookingHistoryResponseSchema` / `CookingHistory`、`CookingHistoryIdParamsSchema`                          |
| 通用错误                   | `ApiErrorResponseSchema`、`ApiErrorIssue`（path 与 message，A08/A09 422 issues）                                                                                                                                                                                    |
| 份数计算                   | `scaleIngredientAmount`、`recipeTotalMinutes` 为 shared 纯函数；Web当前仍保留临时版本，联调时应切换到shared实现。                                                                                                                                                   |

特别说明：A08 预校验必须能把语法正确但字段有误的 JSON 送到服务端收集全部问题；`RecipeImportValidationRequestSchema` 应校验 version / recipes 外层和数量边界，但不能先用严格 `RecipeInputSchema` 把所有单条字段错误挡在浏览器。A09 正式写入则使用严格 `RecipeImportInputSchema`。字段、错误形状仍遵循现有 API 设计，不因前端消费而改写。

## 3. 共通设计与使用方式

- [共通设计与数据 Contract](COMMON.md)：字段、约束、错误、厨房版本控制、数据存储和视觉规范。
- [设计图提示词](screens/images/PROMPTS.md)是生成/修改设计图的唯一提示词维护入口，按S00–S08分节，包含通用约束、当前Memo规范、主提示词、补充状态和历史生成记录。画面设计书只链接对应章节，不重复存放提示词。一次生成一个画板，生成图只是视觉参考，业务行为以设计书为准。
- 仅调整视觉生成表达时改提示词；若改变业务规则、字段或交互，仍需同步需求、COMMON、画面/API设计及实施 Contract。生成后更新图集索引、实际记录和项目地图，旧图未更新时明确差异。
- 提示词中的示例菜名是测试内容，不是内置生产数据；“纯文字”限制菜谱照片、插画、封面和占位图，不限制基础按钮图标和 PWA 安装图标。
- API 示例是预定响应；只有 A01 的响应与现有实现一致。各接口通过共通 Contract 避免重复字段说明；实现后接口代码、设计书与测试一起更新。

## 4. 本次细化的设计取舍

已确认的需求补充：原份数默认1但可改；手机详情与发送弹层逐道调整目标份数，厨房保留各菜目标；仅纯数字按比例显示参考用量，每食材可关闭换算，文字量/步骤/时间保持原文。同步详见[COMMON份数换算](COMMON.md#311-份数换算)。这属于V1预定行为，尚未实现。

另已确认：V1随机菜谱从全部已保存菜谱等概率抽一道，忽略列表筛选/已加载分页，“换一个”仅排除当前菜。S01推荐区与A14已补充设计，提示词统一更新在PROMPTS；不是系统通知、AI服务或厨房自动发送。V2随机外卖与平台分享店铺/菜品链接的需求记在[需求10.1](../requirements/REQUIREMENTS_V1.md#101-v2随机外卖已记录v1不实施)，不在V1创建平台集成或外卖API。

份数上限与份数换算精度已确认：原份数 / 目标份数 1～100；数值最多显示两位小数，四舍五入并去掉尾随零，近似结果标“约”，极小正值显示“少于0.01”；超出安全计算精度则保留原文并标“未换算”。Web 当前有已测临时格式逻辑，必须由 shared 导出规范实现后再替换，不能作为 shared Contract 已落地。

已确认做饭历史：厨房完成自动记整顿、详情可手动记；保存时间/当时名字/目标份数，打开最新菜谱，删菜留文字；可确认删除一次误记而不影响厨房。A13与A15明确区分清空/完成，S08和A15–A18均只是预定设计，不是已实施功能。

已确认当前视觉改为可爱奶油黄Memo；Android厨房同色系、大字大按钮，不再强制黑白。本次只改产品设计和提示词，不改S00技术验证页或PWA运行时主题；S00不是正式产品首页。最新Memo及做饭历史主图已生成，手机长内容自然滚动；旧V1/V2 PNG已按用户要求删除，实际输入历史保留。

以下是设计初稿的实施建议，不是此前聊天已经逐项确认的新需求：

1. 单道短菜谱能完整放下时合并食材与步骤，只留“完成”。其余竖屏先食材后步骤；超长食材和单个超长步骤都允许续页，不能裁掉内容。横屏按两栏布局。
2. 手机查看厨房菜单只在打开弹层 / 手动重试时请求，不后台轮询。厨房完成不推送、不弹手机通知。
3. 增加厨房 `revision` 防止旧屏“完成”把刚发送的新菜单清掉。切换、发送、清空遇到冲突时重新读取，绝不悄悄覆盖。
4. 厨房读接口返回完整菜谱快照，菜谱编辑也更新厨房版本；不能只比较菜谱 id，否则同一道菜改了做法屏幕不会刷新。
5. JSON 预校验与正式导入分两步；正式写入前再次校验并事务提交，预校验成功不代表之后一定成功。
6. 同一默认用户下，菜名去除两端空白后唯一，新建、编辑与导入规则一致。若将来需要同名不同版本菜谱，需同时调整唯一约束与导入重复规则。
7. 手机发送菜单会先展示现有菜单，非空时按钮明确写“替换厨房菜单”。请求仍以版本控制确认，避免读取后状态变化造成无意覆盖。

尚待设备实测：实际 CSS 视口、字号、分页结果、可更新的浏览器、Wake Lock 支持、屏幕超时与充电设置。屏幕英寸 / ppi 不能直接推导 CSS 视口，750×1000 只作为参考画板，不是硬件保证。

## 5. 已生成的画面参考图

[查看S00–S08当前Memo主图与补充图](screens/images/README.md) · [唯一提示词入口及实际生成记录](screens/images/PROMPTS.md)。2026-10-08生成9张V3主图及表单中段、厨房横屏两张补充图，共11张PNG。旧16张V1/V2图片已按用户要求删除，历史输入记录保留。

手机采用390×844、厨房竖屏750×1000/横屏1000×750参考比例，输出高清尺寸。长表单首屏只显示基本信息，后续自然滚动；约10寸Android厨房采用同色Memo、大字大按钮与空间充足时的两栏阅读，实际分页仍按真机CSS视口。

S00仍是技术验证页，非正式产品首页；本次仅更新设计图和文档，不改代码、PWA主题或业务。历史/完成/更多操作及异常状态未全部绘图，不以主图替代功能验收。JSON结构片段不是有效导入文件。实施按需求、COMMON及对应设计书，视觉还原边界见[图集验收](screens/images/README.md#视觉还原与验收)。
