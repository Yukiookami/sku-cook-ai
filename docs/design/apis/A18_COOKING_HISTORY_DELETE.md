# A18 DELETE /api/cooking-history/:id

状态：待实现。调用方：[S08](../screens/S08_COOKING_HISTORY.md)删除误记。预定shared历史id参数Schema；删除的是一次完整做饭记录，厨房来源可包含多道，V1不单独删除其中一道。

## 请求 / 成功204

id为正整数；无Body/userId。成功204 No Content，不返回历史或菜谱DTO；前端不解析JSON。

默认用户事务锁 → 按历史id+用户确认存在 → 事务删除该CookingHistory及其从属项 → 提交。Recipe、厨房菜单/目标份数/revision不变，不撤销完成、不重建旧菜单，不清空其他历史。

用户确认由画面负责；服务端仍必须校验归属。没有“删除全部”、日期批量清理或自动保留期限；历史持久保存直到用户删除。

## 错误与测试

400 INVALID_INPUT；404 COOKING_HISTORY_NOT_FOUND（不存在/他人记录/已删）；500/503通用。响应不确定先A16查看，不盲重试DELETE或显示假成功。

测试手动单项/厨房多项一次整组删、默认用户隔离、第二次404、事务回滚、Recipe及KitchenSession完全不变、204确实无Body。删厨房历史后旧完成请求仍因会话revision不符被拒，不重新记历史。
