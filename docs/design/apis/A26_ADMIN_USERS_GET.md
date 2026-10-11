# A26 GET /api/admin/users

状态：shared/API/Web已实现，mock测试覆盖。管理员迁移已在本机备份及专用数据库验证后应用；完整多设备验收待执行。调用方：[S12](../screens/S12_ADMIN_USERS.md)。

## 请求与权限

要求持久会话，服务端读取当前用户 `isSuperAdmin`，只有true可以读取。普通用户403 `ADMIN_REQUIRED`，未登录401；不接受客户端权限。GET，无Body，严格Query仅可选page，整数1～100000、默认1，固定每页20人。

## 成功200

`AdminUsersResponseSchema`：`{items:[{id,username,email,createdAt}],page,hasMore}`。
email可为null，createdAt为ISO日期；按createdAt DESC/id DESC，读取21项判断下一页，最多返回20项。no-store，不返回name、passwordHash、usernameKey、会话或业务数据。

## 错误与边界

非法Query400，数据库不可用503，未知失败500且记录日志，沿用COMMON envelope。没有修改、删除、改密、修改权限接口；不能凭管理员权限读取其他用户菜谱。
