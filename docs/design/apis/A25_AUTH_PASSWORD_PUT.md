# A25 PUT /api/auth/password

状态：shared / API / Web已实现，mock HTTP及密码散列测试覆盖；真实数据库事务/并发验收待执行。调用方：S11确认修改密码。

## 1. 请求

要求有效cookie会话，身份只取authenticatedUser.id。JSON Body上限4096字节，无Query。

`UpdatePasswordRequestSchema`：严格 `{currentPassword,newPassword}`；两者复用PasswordSchema，8～128位且不能全为空白；不trim。拒绝userId及其他未知字段。

S11本地校验后确认再调用；取消确认不会请求API。服务端不能依赖前端确认或密码判断。

## 2. 成功 200

`UpdatePasswordResponseSchema`：`{"user":{"id":42,"username":"Alice"}}`，仅公开当前用户。

按认证ID读取当前散列，复用auth.crypto.verifyPassword校验；复用hashPassword生成独立盐scrypt新散列。校验/散列在事务外，随后事务内updateMany按ID和旧passwordHash原子比较更新；若旧散列已变更，409而不覆盖。事务内读取公开用户响应；读取失败回滚更新。只修改passwordHash及自动updatedAt，不改用户名、ID或业务归属。

不写明文、不记录密码/散列到日志或错误；响应no-store。不创建/撤销/轮换会话，保持当前及其他设备已有登录，cookie沿用原续期策略，不新增会话过期。允许新密码与当前密码相同，不引入额外未确认强度/历史规则。前端成功清空两项密码并更新currentAccount。

## 3. 错误

沿用 `ApiErrorResponseSchema`：`{error:{code,message,issues?}}`。

| 状态 | code                       | 含义                                          |
| ---- | -------------------------- | --------------------------------------------- |
| 400  | INVALID_INPUT              | 非法密码、未知字段或Query                     |
| 400  | CURRENT_PASSWORD_INCORRECT | 当前密码不正确，不使用401以免错误清理有效会话 |
| 401  | UNAUTHENTICATED            | 未登录或会话无效，先于输入校验                |
| 403  | INVALID_ORIGIN             | 跨站写入                                      |
| 409  | PASSWORD_CHANGED           | 校验后散列被其他改密替换，请重新输入当前密码  |
| 413  | PAYLOAD_TOO_LARGE          | Body超限                                      |
| 503  | SERVICE_UNAVAILABLE        | 数据库不可用                                  |
| 500  | INTERNAL_ERROR             | 未知错误                                      |

失败不自动重发，前端保留输入并显示明确错误；无凭据回显。
