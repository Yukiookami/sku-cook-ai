# A24 PATCH /api/auth/username

状态：shared / API / Web已实现，mock HTTP测试覆盖；真实数据库唯一约束及并发验收待执行。调用方：S11用户中心。

## 1. 请求

要求有效cookie会话，身份只取authenticatedUser.id。JSON Body上限4096字节，无Query。

`UpdateUsernameRequestSchema`：严格 `{username}`。复用UsernameSchema：3～32位ASCII，英文字母开头，后续仅字母、数字、下划线；不trim，保留大小写显示。未知字段（含userId）拒绝。

## 2. 成功 200

`UpdateUsernameResponseSchema`：`{"user":{"id":42,"username":"Alice","email":null,"isSuperAdmin":false}}`。

单条原子update按认证ID更新name/username及小写usernameKey，数据库既有唯一索引和CHECK约束兜底；不改变ID、业务外键或密码。相同名字及仅改大小写均允许，其他账号占用不允许。并发用户名更新按数据库实际写入顺序，最后成功写入生效，无新增版本字段。

响应no-store，公开id/username/email/isSuperAdmin，不返回密码；邮箱和权限保持原值，token不轮换，会话不撤销，cookie沿用认证钩子的滚动续期。前端使用返回用户更新currentAccount，其他设备下次请求重新读取用户名。

## 3. 错误

沿用 `ApiErrorResponseSchema`：`{error:{code,message,issues?}}`。

| 状态 | code                | 含义                           |
| ---- | ------------------- | ------------------------------ |
| 400  | INVALID_INPUT       | 非法用户名、未知字段或Query    |
| 401  | UNAUTHENTICATED     | 未登录或会话无效，先于输入校验 |
| 403  | INVALID_ORIGIN      | 跨站写入                       |
| 409  | USERNAME_TAKEN      | usernameKey唯一约束冲突        |
| 413  | PAYLOAD_TOO_LARGE   | Body超限                       |
| 503  | SERVICE_UNAVAILABLE | 数据库不可用                   |
| 500  | INTERNAL_ERROR      | 未知错误，不伪装成用户名占用   |

不返回请求凭据、散列或内部异常；不接受客户端userId。
