# A20 POST /api/auth/register

状态：shared / API / Web 已实现，mock HTTP 与加密测试覆盖；认证迁移未应用，真实数据库验收待执行。调用方：S10 注册入口。

## 1. 请求

公开入口，`Content-Type: application/json`，Body 上限 4096 字节，无 Query。

严格 `{username,password}`，字段约束见 [COMMON 1.1](../COMMON.md#11-v2-账号会话与隔离) / `AuthCredentialsSchema`：
username 3–32 字符，英文字母开头，仅 ASCII 字母、数字、下划线，大小写保留显示，忽略大小写唯一；password 8–128 字符且不全为空白。不 trim，不接受 email、userId 或额外字段。

## 2. 成功 201

`AuthResponseSchema`：`{ "user": { "id": 2, "username": "Alice" } }`。

设置 HttpOnly / SameSite=Lax / 生产 Secure 的持久 `sku_session` cookie，响应 no-store。token 不出现在 JSON。
注册完成即登录：用户与会话同一事务创建；撤销该浏览器已有 token，其他设备不受影响。scrypt 在事务前计算，数据库不保存明文密码/token。

## 3. 错误

沿用 COMMON error envelope：

| 状态 | code                            | 含义                                       |
| ---- | ------------------------------- | ------------------------------------------ |
| 400  | INVALID_INPUT / INVALID_REQUEST | 字段、Query 或 JSON 格式非法               |
| 403  | INVALID_ORIGIN                  | 浏览器跨站写入                             |
| 409  | USERNAME_TAKEN                  | 账号名忽略大小写冲突（含并发唯一索引冲突） |
| 413  | PAYLOAD_TOO_LARGE               | 超过认证 Body 上限                         |
| 503  | SERVICE_UNAVAILABLE             | 数据库不可用                               |
| 500  | INTERNAL_ERROR                  | 其他持久化失败，不暴露内部详情             |

失败不设置新 cookie、不留下半个账号；相关事务回滚尚需专用数据库验证。

## 4. 数据与验收

写 users 与 auth_sessions，不写菜谱/厨房/历史；新账号无业务数据。旧 id=1 数据仍归 Sku001，不能通过注册取得旧用户归属。
测试覆盖 Schema 边界、未知字段、哈希、不透明 token、cookie 和 username 唯一错误映射；真实并发重复注册、事务回滚与数据库约束未验收。
