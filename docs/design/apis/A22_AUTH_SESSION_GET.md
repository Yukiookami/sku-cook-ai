# A22 GET /api/auth/session

状态：shared / API / Web 已实现，mock HTTP测试覆盖；本机迁移已应用，真实数据库HTTP确认当前用户/权限响应通过，长期Cookie及多设备仍待验收。调用方：S10 启动会话检查和登录状态恢复。

## 1. 请求

无 Query，无 Body；携带浏览器自动管理的 `sku_session` cookie。
该接口要求登录。仅接受一个格式正确的 64 位十六进制 token，按 SHA-256 哈希查持久会话，再读取当前用户。
不接受客户端 userId、username 或 token Query。

## 2. 成功 200

`AuthResponseSchema`：`{ "user": { "id": 1, "username": "Sku001", "email": null, "isSuperAdmin": true } }`。每次会话读取用户当前邮箱及权限，不信任客户端权限；权限不缓存于token中。

响应 no-store，cookie 按 10 年 Max-Age 滚动续期，token 值不轮换。所有已认证业务请求也续期 cookie。
服务端不设 expiresAt、idle timeout；createdAt 不参与失效判定，不依赖内存 session。cookie/数据库持久性及浏览器自身生命周期边界见 [COMMON 1.1](../COMMON.md#11-v2-账号会话与隔离)。

## 3. 错误

| 状态 | code                | 含义                                              |
| ---- | ------------------- | ------------------------------------------------- |
| 400  | INVALID_INPUT       | 已认证请求包含未知 Query                          |
| 401  | UNAUTHENTICATED     | cookie 缺失、格式非法、重复或 token 不存在/已撤销 |
| 503  | SERVICE_UNAVAILABLE | 数据库不可用，不伪装成 401                        |
| 500  | INTERNAL_ERROR      | 其他内部错误                                      |

查询不到会话时清理失效 cookie。401 先于业务参数校验；不返回 `{user:null}` 或假成功。

## 4. 用户范围与验收

会话返回公开用户字段，现有 A02–A19 用户归属由同一认证钩子确定。
测试覆盖未登录 401、旧 createdAt 会话仍有效、滚动 cookie、撤销后 401 和数据库 503。真实服务重启、数据库会话跨进程读取、浏览器关闭重开与长期 cookie 未验收。
