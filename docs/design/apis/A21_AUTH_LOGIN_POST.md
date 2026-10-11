# A21 POST /api/auth/login

状态：shared / API / Web 已实现，mock HTTP 与加密测试覆盖；认证迁移未应用，真实数据库验收待执行。调用方：S10 登录入口。

## 1. 请求

公开入口，`Content-Type: application/json`，Body 上限 4096 字节，无 Query。
严格 `{username,password}`，共享 `AuthCredentialsSchema`，字段约束与 [A20](A20_AUTH_REGISTER_POST.md) 相同。按小写 usernameKey 查询，密码原样验证，不 trim。
无邮箱、验证码、找回密码或默认用户回退。

## 2. 成功 200

`AuthResponseSchema`：`{ "user": { "id": 1, "username": "Sku001" } }`。

设置持久 `sku_session` cookie（HttpOnly / SameSite=Lax / 生产 Secure），响应 no-store。
响应 username 来自数据库，保留原始大小写；不返回哈希/token。随机 token 只存 SHA-256 哈希。
同一事务创建新会话并撤销该浏览器旧 token；其他设备会话仍有效。服务端会话没有空闲/到期失效。

## 3. 错误

| 状态 | code                            | 含义                                               |
| ---- | ------------------------------- | -------------------------------------------------- |
| 400  | INVALID_INPUT / INVALID_REQUEST | 非法字段、Query 或 JSON                            |
| 401  | INVALID_CREDENTIALS             | 账号不存在、密码错误、旧账号未初始化密码均统一响应 |
| 403  | INVALID_ORIGIN                  | 浏览器跨站登录 CSRF                                |
| 413  | PAYLOAD_TOO_LARGE               | Body 超限                                          |
| 503  | SERVICE_UNAVAILABLE             | 数据库不可用                                       |
| 500  | INTERNAL_ERROR                  | 其他异常                                           |

不存在/无密码账号同样执行 KDF，密码比较使用 timingSafeEqual。失败不改已有会话，不记录密码。

## 4. 数据与验收

只读 users，写 auth_sessions；登录不更改业务数据。旧 Sku001 密码仅由本机 BOOTSTRAP_USER_PASSWORD 幂等 Seed 初始化，实际值不写入任何文档。
测试覆盖大小写查询、正确/错误密码、旧空哈希、token 换发与原 token 撤销调用；真实数据库会话持久化与服务重启后登录保留尚未验收。
