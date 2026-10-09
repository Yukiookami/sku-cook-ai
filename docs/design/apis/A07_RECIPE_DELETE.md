# A07 DELETE /api/recipes/:id

状态：源码已实现；初始迁移已应用于本地开发数据库；A07删除及关联行为尚未通过真实HTTP验收。调用方：[S02](../screens/S02_RECIPE_DETAIL.md)。删除二次确认由画面负责，不能只靠接口没有确认就直接触发。

## 请求 / 成功

id为正整数；无Body或userId。`DELETE /api/recipes/101`。

成功204 No Content，无JSON Body。Axios调用方不能再尝试解析RecipeResponse。

## 事务处理

同用户事务锁 →确认id属于默认用户→删除Recipe的从属食材/步骤与标签关系→移除厨房菜单成员→若删当前菜选择剩余有序菜单第一道，若无剩余active=null→菜单发生变化时revision+1→删除Recipe→提交。

删除非菜单菜谱不改会话版本。删除菜谱不删除User、不建文件清理逻辑。移除成员时连同其targetServings移除，剩余成员份数不变；items/recipeIds/recipes保持同序。会话成员顺序重新保持连续；不能留下指向已删除菜谱的activeRecipeId。手机不推送，厨房下一次成功轮询看到变化。

已有CookingHistory项在同事务将该Recipe引用置null（SetNull），保留做饭时间、当时title及targetServings，不级联删历史、不更名；A16返回“已删除”的可空引用供画面禁用查看做法。并发手动记录/A15完成与此删除共用用户锁。

## 错误与测试

400 INVALID_INPUT；404 RECIPE_NOT_FOUND（已删/不存在/不属于默认用户）；500/503通用。第二次删除返回404，不返回假的成功对象；预期客户端可重新GET确认。

测试菜单外、当前菜、非当前菜、仅一道菜、剩余多道顺序、同时发送/完成/删除/手动记录竞态、历史引用置null且名字/份数保留、所有事务回滚、不影响其他用户。204确实无Body。
