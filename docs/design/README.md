# V1 设计书索引

状态：2026-10-08 设计初稿，业务设计待实施。当前只有基础首页与 health 已实现；本文档不代表菜谱、厨房业务已经完成。

依据：[需求文档](../requirements/REQUIREMENTS_V1.md)、[技术栈](../architecture/TECH_STACK.md)、[目录规划](../architecture/PROJECT_STRUCTURE.md)。需求定义范围，设计书细化交互与接口，实施时在 shared 中建立相应 Zod Contract。设计不新增登录、图片、AI Runtime、通知、离线写入或 TodoList。

## 1. 画面设计书

每个路由页面独立一份；共用厨房弹层另外单列，避免在列表和详情里重复定义。

| 编号 | 画面                                                    | 路由 / 形态                                | 状态       |
| ---- | ------------------------------------------------------- | ------------------------------------------ | ---------- |
| S00  | [基础首页](screens/S00_HOME.md)                         | 当前 `/`；业务上线后 `/` 重定向 `/recipes` | 已有过渡页 |
| S01  | [菜谱一览](screens/S01_RECIPE_LIST.md)                  | `/recipes`                                 | 待实现     |
| S02  | [菜谱详情](screens/S02_RECIPE_DETAIL.md)                | `/recipes/:id`                             | 待实现     |
| S03  | [新增菜谱](screens/S03_RECIPE_CREATE.md)                | `/recipes/new`                             | 待实现     |
| S04  | [编辑菜谱](screens/S04_RECIPE_EDIT.md)                  | `/recipes/:id/edit`                        | 待实现     |
| S05  | [批量导入](screens/S05_RECIPE_IMPORT.md)                | `/recipes/import`                          | 待实现     |
| S06  | [厨房显示](screens/S06_KITCHEN_DISPLAY.md)              | `/kitchen`                                 | 待实现     |
| S07  | [发送 / 查看厨房菜单弹层](screens/S07_KITCHEN_PANEL.md) | S01 / S02 共用，不增加路由                 | 待实现     |

静态路径 `new`、`import` 与 id 路由明确区分；详情 id 只能是正整数。不存在的前端路由显示简洁的“页面不存在 / 返回菜谱”状态，不另外设计业务页面。

## 2. API 设计书

一次请求的方法与路径对应一份设计书。请求前缀统一为 `/api`。

| 编号 | 接口                                                                  | 调用画面           | 状态   |
| ---- | --------------------------------------------------------------------- | ------------------ | ------ |
| A01  | [GET /api/health](apis/A01_HEALTH_GET.md)                             | S00                | 已实现 |
| A02  | [GET /api/recipes](apis/A02_RECIPES_GET.md)                           | S01、S05           | 待实现 |
| A03  | [GET /api/recipes/tags](apis/A03_RECIPE_TAGS_GET.md)                  | S01、表单建议项    | 待实现 |
| A04  | [GET /api/recipes/:id](apis/A04_RECIPE_GET.md)                        | S02、S04           | 待实现 |
| A05  | [POST /api/recipes](apis/A05_RECIPE_POST.md)                          | S03                | 待实现 |
| A06  | [PUT /api/recipes/:id](apis/A06_RECIPE_PUT.md)                        | S04                | 待实现 |
| A07  | [DELETE /api/recipes/:id](apis/A07_RECIPE_DELETE.md)                  | S02                | 待实现 |
| A08  | [POST /api/recipes/import/validate](apis/A08_IMPORT_VALIDATE_POST.md) | S05                | 待实现 |
| A09  | [POST /api/recipes/import](apis/A09_IMPORT_POST.md)                   | S05                | 待实现 |
| A10  | [GET /api/kitchen/session](apis/A10_KITCHEN_GET.md)                   | S06、S07           | 待实现 |
| A11  | [PUT /api/kitchen/session](apis/A11_KITCHEN_PUT.md)                   | S07 发送菜单       | 待实现 |
| A12  | [PATCH /api/kitchen/session/active](apis/A12_KITCHEN_ACTIVE_PATCH.md) | S06 切换菜谱       | 待实现 |
| A13  | [DELETE /api/kitchen/session](apis/A13_KITCHEN_DELETE.md)             | S06 完成、S07 清空 | 待实现 |

## 3. 共通设计与使用方式

- [共通设计与数据 Contract](COMMON.md)：字段、约束、错误、厨房版本控制、数据存储和视觉规范。
- 每份画面设计书都有可独立复制的 AI 主提示词和补充状态提示词。一次生成一个画板，保持相同字体、边距、按钮和配色；生成图只是视觉参考，业务行为以设计书为准。
- 提示词中的示例菜名是测试内容，不是内置生产数据；“纯文字”限制菜谱照片、插画、封面和占位图，不限制基础按钮图标和 PWA 安装图标。
- API 示例是预定响应；只有 A01 的响应与现有实现一致。各接口通过共通 Contract 避免重复字段说明；实现后接口代码、设计书与测试一起更新。

## 4. 本次细化的设计取舍

以下是设计初稿的实施建议，不是此前聊天已经逐项确认的新需求：

1. 单道短菜谱能完整放下时合并食材与步骤，只留“完成”。其余竖屏先食材后步骤；超长食材和单个超长步骤都允许续页，不能裁掉内容。横屏按两栏布局。
2. 手机查看厨房菜单只在打开弹层 / 手动重试时请求，不后台轮询。厨房完成不推送、不弹手机通知。
3. 增加厨房 `revision` 防止旧屏“完成”把刚发送的新菜单清掉。切换、发送、清空遇到冲突时重新读取，绝不悄悄覆盖。
4. 厨房读接口返回完整菜谱快照，菜谱编辑也更新厨房版本；不能只比较菜谱 id，否则同一道菜改了做法屏幕不会刷新。
5. JSON 预校验与正式导入分两步；正式写入前再次校验并事务提交，预校验成功不代表之后一定成功。
6. 同一默认用户下，菜名去除两端空白后唯一，新建、编辑与导入规则一致。若将来需要同名不同版本菜谱，需同时调整唯一约束与导入重复规则。
7. 手机发送菜单会先展示现有菜单，非空时按钮明确写“替换厨房菜单”。请求仍以版本控制确认，避免读取后状态变化造成无意覆盖。

尚待设备实测：实际 CSS 视口、字号、分页结果、可更新的浏览器、Wake Lock 支持、屏幕超时与充电设置。屏幕英寸 / ppi 不能直接推导 CSS 视口，750×1000 只作为参考画板，不是硬件保证。
