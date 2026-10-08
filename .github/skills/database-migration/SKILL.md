---
name: database-migration
description: '增加/修改 Prisma 模型、PostgreSQL 约束、迁移或 Seed 时使用；评估数据影响、生成版本化迁移、验证幂等/事务，避免误清数据库。'
---

# 数据库模型与迁移

需要此Skill：数据库变化有持久性风险，流程与单纯API编码不同。无需另建“自动生成全部数据库”Skill；每次只落实当前业务切片。

1. 读backend规则、当前schema、已存在迁移、Axx/COMMON，确认表归属、关系、必填/可选、唯一性、顺序和事务不变量。设计已有建议未确认时先协调。
2. 确认目标是本地开发或独立测试库；只报告环境类别，不输出数据库密码/完整URL。检测Docker/数据库是否可用，不擅自安装或更换环境。
3. 说明新增列、默认值、索引、外键和删除策略的数据影响；已有数据需要回填、重命名、删除/收紧约束时先说明方案并取得批准。备份日常数据，不借测试清理生产。
4. 修改Prisma Schema，保持CLI/Client版本一致；运行`pnpm db:generate`与`pnpm --filter @sku-cook/api exec prisma validate`。
5. 数据库可用时使用Prisma生成有意义名称的迁移，例如`pnpm db:migrate --name add_recipes`；检查生成SQL是否意外DROP、截断或改变既有字段。不手写伪造工具输出，不用db push代替版本化迁移。
6. 在专用测试环境应用迁移，验证空库初始化、已有数据升级、约束、外键、回滚业务事务；Seed连续两次执行不重复创建。部署已有迁移使用API包db:deploy，不在生产用migrate dev。
7. 运行受影响共享/API类型、测试和构建；生成Client不提交，schema与真实迁移提交，记录风险/备份/恢复方案。
8. 更新地图（含新迁移文件职责）、接口/COMMON设计与环境说明。数据库不可用时只交付schema/生成校验，明确迁移/Seed/集成尚未验收，不伪造成功。

禁止未经明确授权运行migrate reset、drop/truncate、删除Volume或对用户日常数据库做测试清理。恢复采用已确认备份/前向修复，不承诺Prisma自动down migration。
