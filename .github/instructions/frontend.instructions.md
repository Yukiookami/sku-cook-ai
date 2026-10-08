---
description: '修改 Vue、Vant、移动端页面、前端请求、路由、PWA 或厨房平板界面时使用的前端规则。'
applyTo: 'apps/web/**'
---

# 前端规则

- 遵守仓库全局规则，实施前读相关 Sxx 画面设计书、关联 Axx 接口与设计 COMMON。AI 设计图只做视觉参考，不能增加图片、收藏、通知等范围外功能。
- 使用 Vue 3 Composition API / script setup lang="ts"；Vant 4 按需引入，主题优先 CSS 变量，布局用 CSS Flex/Grid，不引入 Tailwind 或另一套组件库。
- View 负责流程组合；API 调用只放 src/api，响应按 shared Contract 校验；组件不直接访问数据库、Fastify 或服务端配置。
- 局部状态用 ref/reactive；只有确需跨页状态才用 Pinia。composable 抽取实际复用或独立生命周期逻辑，不把所有逻辑强制抽出。
- 表单新增/编辑复用 RecipeForm 与 shared 输入 Schema；避免复制校验。服务端生成字段不回传，空可选数字不转换为0，中文食材数量保留为字符串。
- 手机为布局基准，普通页允许滚动；触底加载并发去重，条件变化取消/忽略旧响应；loading、空库、无搜索结果、断网和业务失败明确区分。
- 请求写入防重复点击；失败保留输入。提交结果不确定先重新查询，不自动重发POST或旧版本厨房操作。
- 厨房只用按钮，不做手势导航；字号/点击区域/分页按 S06，超长内容必须可达，不能缩字或裁掉。相同可见内容不重绘，版本冲突重新读取。
- 手机不轮询厨房状态、不推送完成通知。厨房轮询串行、后台暂停、回来前台重读，防旧响应覆盖新菜单。
- Wake Lock 做能力与安全上下文检查，释放与重新申请随页面生命周期管理，失败明确降级到系统设置；不能承诺唤醒熄屏设备。
- 纯文本渲染用户输入，不用v-html；来源链接只允许http/https。VITE_值公开，不能存密钥。PWA缓存静态资源，不缓存业务API。
- 中文界面文案，错误文字就地可读，不只短Toast；按钮有文字/可访问名称，不仅用颜色表示状态；保留焦点、键盘操作与底部安全区。
- 测试用 Vitest + Vue Test Utils；验证用户行为、边界和异步响应，不只snapshot。视觉/响应式改动可用浏览器检查，并明确真机未验证。
- 常用检查：先 `pnpm --filter @sku-cook/shared build`；Web按需执行 `pnpm --filter @sku-cook/web test`、`typecheck`、`build`，并对改动文件运行lint/format检查。目录/职责变化同步PROJECT_MAP。
