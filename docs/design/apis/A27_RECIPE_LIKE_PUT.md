# A27 PUT /api/recipes/:id/like

状态：shared、API 和列表/详情共用组件已实现；mock HTTP/组件测试及备份恢复专用数据库迁移验证覆盖。本机迁移已部署；重新启动 API 后使用。

## 1. 用途与输入

[S01](../screens/S01_RECIPE_LIST.md)、[S02](../screens/S02_RECIPE_DETAIL.md)为当前账号自己的菜谱点爱心或取消。含义固定为“喜欢吃，也做得好吃”，不是做饭历史、评分或厨艺统计。

- 必须登录；身份来自持久会话，不接收 userId。
- Params：`id` 正整数；Query 必须为空；JSON body 最大4096字节。
- 严格 `RecipeLikeRequestSchema`：`{"isLiked":true}` 或 `{"isLiked":false}`。缺失、非布尔值及未知字段返回400 `INVALID_INPUT`。

## 2. 成功与失败

200 `RecipeLikeResponseSchema`：`{"id":11,"isLiked":true}`；`Cache-Control: no-store`。

401 `UNAUTHENTICATED`；跨站写入403 `INVALID_ORIGIN`；菜谱不存在或不属于当前账号404 `RECIPE_NOT_FOUND`；数据库不可用503，未知异常500，使用统一错误日志与 envelope，不返回假成功。

单条参数化 UPDATE 同时限定 id/user_id，原子设置明确目标状态，重复相同请求幂等。只写 `is_liked`，不更新 `updated_at`，避免爱心改变列表更新时间排序；不同设备同时写入以数据库最后完成写入为准，不新增 revision。

## 3. 数据及界面边界

Recipe 新增 NOT NULL DEFAULT false 的 `is_liked` 列，旧菜谱默认未标记；普通编辑保留标记，新增及JSON/Excel导入默认false。JSON导出不携带个人标记。

Recipe/RecipeSummary公开 `isLiked`；shared读旧响应缺失字段时默认false。列表、详情、随机及厨房内嵌Recipe统一使用该Contract；不增加爱心筛选、随机权重或厨房按钮。

按钮复用 RecipeLikeButton；空心/实心及“点爱心 / 已点爱心”同时表达状态，点击区≥44px、aria-pressed。成功响应后更新，等待中及列表多选模式禁用；详情其他写入中禁用。失败保留旧状态并显示可读错误，结果不明先刷新核对，不自动重发。组件换菜谱或卸载后忽略旧响应。

## 4. 验收

严格输入/认证/Origin、本人范围、他人404、true/false/幂等、故障错误形状及参数化SQL有自动化测试；共用按钮、列表及详情入口有行为测试。专用数据库从本机备份恢复后验证默认false、持久化、取消、用户限定和更新时间不变。真实手机/多设备验收仍待执行；未更新设计PNG，不声称已按含爱心的新设计图对照。
