---
description: '修改 Fastify API、Zod Contract、Prisma/PostgreSQL、事务、Seed 或 shared 包时使用的后端规则。'
applyTo: 'apps/api/**,packages/shared/**,compose.yaml'
---

# 后端与共享 Contract 规则

- 遵守全局规则；实施前读对应Axx接口、关联画面及设计COMMON。设计建议先协调确认，不擅自扩大数据模型或引入正式鉴权。
- Fastify route做HTTP接入与基础校验；service处理业务与事务；简单场景直接route→service→Prisma，不强制controller/repository。app构造实例，server只负责配置、启动和退出。
- 请求/响应Zod Schema放shared并推导类型；服务端环境配置和数据库特有校验留API。数据库模型不能直接作为公开响应，避免暴露userId、密码或内部关系。
- 前端校验不可信；校验Body、Query、Params、未知字段与请求大小。所有业务查询/修改带后端确定的默认用户过滤，不接受客户端userId。
- 路由静态路径tags/import与id明确区分；不同成功状态码、204空响应和错误envelope按设计；503/500不能返回空列表或假成功。
- 使用已有错误处理与Fastify/Pino日志，扩展明确业务错误类型或映射，不 broad catch 所有异常伪装成参数/重复错误。日志不记录密码、DATABASE_URL、完整敏感请求或设备认证URL。
- 新增、编辑、导入复用同一归一化与校验规则；唯一性由数据库约束兜底。导入预校验不写库，正式导入重新校验并整批事务提交。
- 厨房状态的成员、顺序、active与revision保持一致；写操作原子比较版本，避免旧完成清新菜单。编辑/删除菜单菜谱同步会话，读取返回一致性快照。
- 在事务内完成相关数据库操作，不在事务中等待设备/第三方网络；外部失败不能被当成核心持久化成功。V1不接Fully Kiosk或AI服务。
- Prisma CLI/Client保持同版；更改模型用工具生成迁移，不手工假造迁移成功。禁止未经批准reset、db push替代版本化迁移、清空或直改生产数据。
- Seed须幂等；集成测试用专用测试数据库，执行前确认目标，不使用默认日常数据库清理数据。
- API业务测试优先既定Vitest/Supertest；不要同场景再重复写inject测试。覆盖非法输入、用户隔离、并发/冲突、回滚与错误形状；数据库无法运行明确未验证。
- shared变更同时验证Web/API的导入、类型与生产构建，保留显式dist导出。shared不访问环境、文件系统、数据库，也不引入Vue/Axios。
- 常用检查：`pnpm --filter @sku-cook/shared build`，对应包test/typecheck/build；模型改动补`pnpm db:generate`及真实数据库迁移验收。目录/职责变化同步PROJECT_MAP。
