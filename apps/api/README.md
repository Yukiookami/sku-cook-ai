# API 本地认证与数据库升级

V2 认证 Contract 见 `docs/design/apis/A20–A23` 与 COMMON。现有业务响应字段不变，但所有 A02–A19 必须带有效 cookie，未登录返回 401。

## 配置

- `DATABASE_URL` 仍使用既定本地 PostgreSQL 目标，不记录完整连接串或密码。
- `NODE_ENV=production` 时 cookie 强制 Secure，必须 HTTPS。
- `APP_ORIGIN` 可选，填写精确浏览器 origin（协议、主机、端口，无路径/尾斜杠）。经 Vite/反向代理访问时应配置浏览器 origin；默认按请求同源校验。无通配 CORS。
- `BOOTSTRAP_USER_PASSWORD` 仅供 Seed，本机环境或未跟踪 `.env` 设置，8–128 字符且不全为空白。不要在命令历史、日志、文档、测试或提交中写真实密码。运行时 API 无需此变量。
- `DEFAULT_USER_ID` 已移除，不再决定业务归属。Bootstrap 固定保留旧用户 id=1。

## 非破坏性升级顺序

本次已执行 Prisma Client 生成、schema validate 和离线 migrate diff，生成迁移 `20261011070000_add_account_auth_sessions`，**Docker engine 未运行，迁移未应用、Seed 未执行**。

数据库恢复后，由操作者确认目标是本地开发库，先做数据备份并验证备份可恢复；不要 reset、db push、删 volume 或清库。此迁移是 Prisma 工具生成结构 SQL 后审查补入的数据回填，部署使用版本化迁移：

1. 确认与备份目标，检查 `prisma/migrations/.../migration.sql`。
2. `pnpm --filter @sku-cook/api db:deploy` 应用已有迁移。
3. 在本机安全设置 BOOTSTRAP_USER_PASSWORD，先构建 shared，再运行 `pnpm db:seed`；连续两次检查 id=1、密码哈希及业务数据归属未变化。
4. Seed 完成后启动新 API；未迁移的数据库不能承载新服务。

迁移新增 users.username/username_key 与 auth_sessions，不删除旧字段或业务记录。id=1 → Sku001；其他旧用户 → Legacy&lt;id&gt;，既有 name/email/password_hash 不变，所有业务 user_id 不变。新增账号名格式、小写键 CHECK、唯一索引、token 哈希格式 CHECK 和会话用户 FK（Cascade）；仅前进 users id 序列，防止旧显式 id Seed 与新注册撞主键。

旧空密码仅由 Seed 初始化 id=1，已有哈希不覆盖。其他无密码旧用户不可登录，不自动重置其密码。序列前进可能在失败后留下跳号，不损失记录。Prisma 不提供自动 down；异常采用备份恢复或评审后的前向修复，不擅自回滚/删除数据。

## 会话

Node scrypt 单向哈希密码；32 字节随机 token 经 cookie 发送，仅保存 SHA-256 哈希。数据库无空闲/绝对过期；cookie 持久 10 年并在认证请求滚动续期。主动退出撤销当前 token，重新登录换发 token，不撤销其他设备。

同源 `/api` 请求由浏览器自动带 HttpOnly cookie，不把 token 放 localStorage。跨站写入包括登录均被拒绝。日志配置遮蔽 Cookie / Authorization / Set-Cookie / password。

## 验证边界

单元与 Supertest 使用 mock 数据库，不连接或清理日常数据库。必须在操作者确认的专用测试库验证：空库初始化、已有 id=1 与菜谱/厨房/历史升级、其他旧用户保留、Seed 双次幂等、用户名大小写并发冲突、注册回滚、两用户 CRUD/导入/导出隔离、厨房写入/完成/删除事务与 revision、持久会话跨进程、退出 token 撤销及多设备独立。尚未完成这些真实数据库验收。
