# A01 GET /api/health

状态：已实现。调用方：[S00](../screens/S00_HOME.md)。现有位置 `apps/api/src/modules/health/health.route.ts`、shared `schemas/health.ts`。

## 请求与响应

无路径参数、Query、Body、认证或 userId。GET 成功200：

```json
{ "status": "ok", "service": "sku-cook-ai-api" }
```

此接口沿用现有直接响应，不改成 `{ data: ... }`。只有 status 的 ok 和固定 service 字面量，不返回数据库连接串、机器名、版本细节。

## 处理

Fastify 接收 → shared HealthResponseSchema 构造/校验 → JSON。无需 Prisma 查询、默认用户查询或文件访问，数据库未启动也可200；这是存活/联通检查，不是数据库 readiness。

## 错误与验收

未知路径由现有 handler 返回404 NOT_FOUND；内部异常500 INTERNAL_ERROR并记录日志，不返回堆栈。连接超时是客户端错误，不返回伪造ok。

测试：正常200与shared校验、数据库不可达仍不查询数据库、实际Vite代理联通。部署不能用这个接口成功替代迁移/Seed验收。
