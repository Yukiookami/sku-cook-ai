---
name: implement-api
description: '根据 Axx 接口设计书实现 Fastify API、共享 Zod Contract、业务服务和测试时使用；覆盖错误、用户范围、事务与前端兼容。'
---

# 按 API 设计书实施后端

1. 读全局/backend规则与项目地图；定位Axx、调用Sxx和COMMON，确认方法路径、输入、响应状态码、错误、用户归属与设计建议。
2. 确认当前模型/Contract与缺口；涉及模型、迁移或Seed时加载database-migration Skill，不把新模型混进无验收的假接口。
3. shared先定义请求/响应Schema及z.infer类型、公开导出与边界测试；复用已有Contract/校验，不把Prisma模型作为响应。
4. 实现route→service→Prisma，route接校验与错误转换，业务规则/事务在service；简单接口可直接route处理，说明必要拆分即可。
5. 接入app注册与生命周期，检查静态/动态路径不冲突；默认用户服务端过滤；成功、204、冲突、404、错误形状严格匹配设计。
6. 写入事务与数据库约束兜底；导入全成功或回滚，厨房revision原子比较和读快照一致。不要用前端检查代替约束。
7. 测试相关共享Schema、API正常/非法/404/冲突与错误不泄漏；数据库业务使用专用测试库验证回滚、用户隔离和并发。模拟数据库测试不能代替真实集成验收。
8. 执行shared/API相关test/typecheck/build、lint/format；Contract影响Web时也验证Web类型/构建。需要时启动编译后API实际请求，health不能替代业务查询。
9. 更新设计书状态与实际地图；报告Contract、数据库变更、验证、未验收项和调用方迁移。不自动commit/push。

## 停止条件

接口需求与设计冲突、数据归属未定、环境指向日常/生产测试清理、需要破坏性迁移：停止询问，不能静默兜底。
