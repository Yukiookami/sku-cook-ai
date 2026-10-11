# A23 DELETE /api/auth/session

状态：shared / API / Web 已实现，mock HTTP 测试覆盖；认证迁移未应用，真实数据库验收待执行。调用方：S10 用户主动退出并切换账号。

## 1. 请求

公开幂等会话入口；无 Query，无 Body（可接受空 JSON 对象），不接受额外字段。
浏览器携带当前 `sku_session` cookie；无 cookie 或 token 已撤销也可调用。
非安全方法仍检查 Origin / Sec-Fetch-Site，拒绝跨站退出。

## 2. 成功 204

空响应，无 JSON Contract。no-store。
若 token 格式正确，删除数据库内对应 token 哈希行；不删除用户，不清理菜谱/厨房/历史，不退出其他设备。
以同名 Path=/ cookie、Max-Age=0 清浏览器会话；HttpOnly / SameSite=Lax / 生产 Secure 与设置时一致。
缺失/非法 token 不访问数据库，也清 cookie；重复退出返回同样 204。

## 3. 错误

| 状态 | code                            | 含义                              |
| ---- | ------------------------------- | --------------------------------- |
| 400  | INVALID_INPUT / INVALID_REQUEST | Query、额外 Body 字段或 JSON 非法 |
| 403  | INVALID_ORIGIN                  | 跨站请求                          |
| 503  | SERVICE_UNAVAILABLE             | 数据库不可用，不能保证撤销        |
| 500  | INTERNAL_ERROR                  | 撤销失败                          |

撤销失败不返回假 204；调用方保留可重试错误，不把仅清理前端状态当作服务器成功退出。

## 4. 验收与调用注意

测试覆盖撤销指定 token、204 空响应、清 cookie、重复退出与旧 token 后续 401。
真实数据库 token 撤销、多设备不互相影响与并发请求边界待验收。已在退出前通过认证的在途请求可能完成；退出后新请求不能使用该 token。
Web 后续适配需停止厨房轮询并清除所有账号相关缓存；不能仅隐藏登录状态。
