# 共通设计与数据 Contract（V1 业务 / V2 账号）

状态：设计约束已确定；shared Contract 与 A02–A18 API 源码已实现，Prisma Schema 已扩展。初始版本化迁移已应用于本地Docker开发数据库，Seed连续执行两次保持一个默认用户；A01、A02、A10、A16真实HTTP只读冒烟检查通过。业务写入、事务与并发数据库集成仍未验收。

## 1. 实现边界

V2用户中心已实现shared/API/Web源码（[S11](screens/S11_USER_CENTER.md)、[A24用户名](apis/A24_AUTH_USERNAME_PATCH.md)、[A25密码](apis/A25_AUTH_PASSWORD_PUT.md)），mock测试覆盖，真实数据库及真机尚未验收。复用现有用户表、usernameKey大小写不敏感唯一约束与auth.crypto，无新增Schema/迁移。服务端身份来自authenticatedUser；修改保留ID、数据归属及全部现有会话，不引入过期或撤销所有设备策略。密码需当前密码+新密码，前端提交前确认且取消不写入；当前密码错误为400，不触发全局401清理。

Vue 3 + Vant 4 + CSS，页面使用 Composition API；Axios 请求集中于 api 目录。后端 Fastify route → service → Prisma，只有确有需要才拆 controller / repository。PostgreSQL 保存数据；JSON导出由浏览器下载，导入读取文本后提交 application/json，不在服务端上传或保存文件。

V2 所有业务归属由服务端持久会话确定，客户端不提供 userId。每次查改删、导入预校验/正式导入、标签、随机和导出均带认证用户过滤；不再使用 `DEFAULT_USER_ID`。业务 API 返回 `Cache-Control: no-store`，Service Worker 不缓存 API。旧版默认用户的历史迁移验收不代表 V2 认证已通过数据库验收。

### 1.1 V2 账号、会话与隔离

账号展示和操作仅在首页“更多”中提供，复用 AccountMenu 展示完整用户名、用户中心和退出/切换账号。PageHeader 仅负责返回、标题与页面操作；厨房显示页同样不放账号入口。认证守卫和会话检查不受入口收纳影响。

状态：shared / API / Web 登录、注册、守卫、退出、用户中心与只读管理员页已实现。本机认证及管理员增量迁移已应用；管理员迁移先在无网络专用数据库恢复备份后验证，8张业务表摘要保持一致，邮箱唯一/小写和单超级管理员约束已验收。其他机器需执行版本化迁移；完整真机及多设备验收仍待执行。

- 一次方法+路径一份设计：[A20 注册](apis/A20_AUTH_REGISTER_POST.md)、[A21 登录](apis/A21_AUTH_LOGIN_POST.md)、[A22 当前会话](apis/A22_AUTH_SESSION_GET.md)、[A23 退出](apis/A23_AUTH_SESSION_DELETE.md)、[A26 用户列表](apis/A26_ADMIN_USERS_GET.md)。开放注册需邮箱，不发送验证邮件；无密码找回、无 AI/认证框架。
- 注册使用严格 `RegisterRequestSchema` 的 `{username,email,password}`；登录使用 `LoginRequestSchema` 的 `{username,password}`，协议字段username可为用户名或邮箱。username仍为3–32个ASCII字符，以英文字母开头，后续仅字母/数字/下划线；不trim，保留大小写显示，usernameKey忽略大小写唯一。邮箱格式校验、最多254字符、转小写，唯一索引及小写CHECK兜底；既有空邮箱账号仍可用用户名登录，不虚构回填邮箱。password 8–128字符、非全空白，不trim、不记录日志。
- 服务端注册201 / 登录200 / 当前会话200 / 用户中心更新均返回 `{user:{id,username,email,isSuperAdmin}}`；shared允许后两个字段缺失以读取旧服务响应，缺失权限不放行。email可为null。仅本人响应包含邮箱与权限；不返回name、哈希或token，退出204空响应。用户ID始终为稳定主键，修改用户名不改变归属。
- `isSuperAdmin`默认false，注册不接收该字段。版本化迁移仅将原id=1账号升级，单超级管理员部分唯一索引兜底；Seed新建id=1时设置管理员，重复Seed不覆盖已有资料/密码。管理员邮箱由部署者私下绑定，不在迁移或源码写真实邮箱。只读管理员列表每页20人，按createdAt/id倒序；每次请求读取数据库当前权限，普通用户403，未登录401。无账号删除、改他人密码或权限操作，管理员权限不开放读取他人菜谱。
- 公开白名单仅 `GET /api/health`、注册/登录 POST 与退出 DELETE。当前会话 GET 和现有 A02–A19 全部需登录；缺失/无效 token 为 401 `UNAUTHENTICATED`，认证先于业务输入校验。外部用户的资源 id 视为 404，不披露归属；数据库不可用保持 503，不伪装成未登录或空业务数据。
- Node crypto scrypt（版本化 `scrypt-v1`、随机盐、N=32768/r=8/p=1、64 字节派生值）保存密码哈希，验证使用 timingSafeEqual。登录不存在/无密码账号也运行 KDF，统一 401 `INVALID_CREDENTIALS`。
- 32 字节随机不透明 token 仅通过 `sku_session` cookie 发送；数据库 `auth_sessions` 只保存 SHA-256 token 哈希、userId 与 createdAt，不设到期、空闲计时或自动清理。Cookie 为 HttpOnly、SameSite=Lax、Path=/，生产 Secure，Max-Age=10 年；认证请求滚动续期。服务端无自动失效；浏览器自身清除 cookie、设备数据删除或浏览器持久存储限制不由服务端保证。
- 注册用户与首个会话同一事务；登录/注册成功撤销该浏览器原 token 并换发新 token，失败不改变原会话。其他设备会话不受影响。退出幂等，仅撤销当前 token，不是退出所有设备。实际撤销失败时返回错误，不返回假 204。
- 所有非安全方法检查 Origin / Sec-Fetch-Site，拒绝跨站写入与登录 CSRF，403 `INVALID_ORIGIN`。默认精确同源；Vite 代理或反向代理场景用服务端 `APP_ORIGIN` 配置精确浏览器 origin，不开启通配 CORS。生产必须 HTTPS。
- 用户行锁按认证 userId 隔离，厨房读取仍为 RepeatableRead 快照。菜谱、厨房成员、历史引用和外卖候选均按已认证用户查询/写入；用户锁用于同一用户外卖候选重复链接查重与写入串行化。外卖非空URL的SHA-256仅作数据库用户范围唯一索引键，不能放入公开DTO；无链接候选的URL和哈希在数据库中均为NULL，不参与去重；HTTP(S) URL由浏览器主动打开，服务端不请求任意外链。不同用户之间的数据和候选链接唯一性互相独立。
- 外链统一以`target="_blank"`打开并加`rel="noopener noreferrer"`。本项目只保存用户主动提供的链接，不自动抓取标题、菜单、价格或预览，不自动下单/付款；分享链接可能包含个人标识，不记录完整URL到日志、提示词或示例。
- 迁移保留所有既有用户 id、name/email/password_hash 与业务外键；id=1 回填账号名 `Sku001`，其他旧用户回填 `Legacy<id>`。旧空密码在 Seed 通过本机 `BOOTSTRAP_USER_PASSWORD` 单向哈希初始化 id=1，已有密码不覆盖，重复 Seed 不改资料或业务数据。其他旧用户若无密码仍不可登录，不以注册重新认领已有数据。
- S01–S09 调用注意：先取得当前会话；401 后阻止业务请求并提示登录，不以空列表替代失败；账号切换/退出须清理客户端菜谱、厨房及历史缓存和轮询。相对 `/api` 同源 cookie 自动发送，跨源必须协调精确 Origin 与 credentials（本次不新增跨源能力）。

## 2. 视觉与 AI 画图通用规则

| 项目              | 手机                                   | 厨房屏                                |
| ----------------- | -------------------------------------- | ------------------------------------- |
| 参考画板          | 390×844 CSS px                         | 竖屏 750×1000、横屏 1000×750 CSS px   |
| 背景 / 主文字     | `#FFFDF8` / `#332E28`                  | 同手机，白色便签卡片                  |
| 辅助文字          | `#716452`                              | 同手机，不作唯一状态表达              |
| 主操作            | 蜂蜜黄 `#FFE28A` 底配深棕 `#332E28` 字 | 同手机，当前菜粗边框加“当前”文字      |
| tag 浅底 / 分割线 | `#FFF4C2` / `#EADCC4`                  | 同手机，可用轻虚线                    |
| 危险色            | `#A93D3D`，同时标注“删除”              | 完成不是危险色，不依赖颜色            |
| 字号              | 正文 16px，标题 24～28px，说明 14px    | 正文 ≥20px，步骤 24～28px，菜名 ≥28px |
| 点击区域          | ≥44px；主按钮 ≥48px                    | ≥56px，按钮之间 ≥16px                 |
| 页面边距          | 20px，纵向间距 12～24px                | 24～32px，主体不能被底部按钮遮挡      |

当前设计是“奶油黄可爱Memo / 圆角便签”：白卡片16～20px圆角、内边距16～20px、按钮14px圆角，可用轻微阴影（建议 `0 4px 16px rgba(70, 50, 20, 0.06)`）、组内浅虚线、标题小色条和少量CSS波浪边；不引入贴纸/吉祥物图片、纸纹、渐变、装饰动画、社交信息或五栏导航。分段互斥切换统一复用 `SegmentedSwitch.vue`，滑动指示器体现选中项；系统开启减少动态效果时关闭转场。正文使用清晰系统字体，标题偏圆润字重，不安装手写字体。全App一致，厨房不再强制黑白，但降低装饰占高并保留大字和按钮。所有画面均可纵向滚动；厨房每次展示当前一道菜的完整内容，不按视口分页。厨房可用菜单与明确按钮切菜，禁止以滑动手势切菜或翻页。平板与桌面访问同一个 Web，不另建 admin。

与用户参考图只共享风格特征，不复制其品牌/画面资产或“100克选择/勺子”等功能。纯文字业务不限制CSS几何装饰；提示词必须使用当前Memo规范，而不是历史V1/V2图中的陶土橙/厨房黑白。常规正文及必要辅助文字对背景至少4.5:1，浅黄按钮用深棕字，不能白字低对比。Web 已将业务画面、技术验证页与PWA主题变量统一到当前Memo奶油黄色系。

错误提示就地显示，必要时 Vant Toast 辅助，但不只用短暂 Toast 呈现字段错误；表单不使用浏览器原生校验气泡，改用与字段关联的页面内错误提示。读接口失败提供重试；提交中禁用重复点击，保留输入。使用明确 loading 状态；厨房不用闪烁骨架或旋转动画。PWA 更新提示属于全局壳，不在每份设计图重复添加。

业务确认统一复用 `ConfirmDialog.vue`，基于现有 Vant Dialog 提供模态遮罩及滚动锁定，`useConfirmDialog` 协调异步确认、取消与组件卸载。覆盖删除菜谱、删除历史、清空厨房、记录做过、修改密码及站内离开未保存表单。使用奶油底、20px圆角、深棕标题/16px正文、14px圆角且至少48px高的按钮，按钮间距12px；普通确认用蜂蜜黄，危险确认用浅红底与深红文字并明确操作名称。默认聚焦取消，Escape取消、Tab保持在操作按钮中，关闭恢复原焦点；长文及小视口可滚动，用户内容只按文本显示。确认和请求期间防重复，取消不写入或清空输入。刷新/关闭标签页的 beforeunload 提示由浏览器控制，无法套用主题，保留系统安全提醒。无独立确认框设计图，不更新PNG。

### 2.1 页面延伸与设备空间

用户补充：手机长表单和长正文无需全部挤进首屏，使用正常字号、点击区域及舒适间距自然向下滚动，固定底部操作不能遮挡最后一项。全站隐藏滚动条外观，但不禁用页面、标签栏、弹层或长内容的滚动。Android厨房平板约10寸，横屏优先食材/做法两栏；厨房当前一道菜的全部内容连续纵向滚动，不凭视口拆页、不缩字或裁内容。

全站移动端使用固定初始 viewport，禁用用户手势缩放；这是明确的交互取舍，会限制用户通过双指缩放放大页面。为避免 iOS 聚焦文本控件时自动放大，文本输入与文本域字号至少为 16px；页面正文与控件仍需保持可读。

## 3. 公共数据类型

ID 为正整数；日期为 ISO 8601 UTC 字符串。请求对象拒绝未知字段（包括图片、userId、服务端生成字段）；响应不暴露数据库模型全部字段。前端可解析响应后进行展示，原始用户文本按纯文本渲染，不使用 v-html。

### 3.1 RecipeInput

| 字段                     | 类型 / 约束                                                     |
| ------------------------ | --------------------------------------------------------------- |
| title                    | 必填 string；trim 后 1～50 字；同一用户唯一                     |
| description              | 可选 string，trim；最多 500 字                                  |
| servings                 | 原菜谱份数，1～100 正整数；省略默认 1，响应始终非 null          |
| prepMinutes、cookMinutes | 可选 0～1440 的整数；0 是合法值                                 |
| difficulty               | 可选 `easy` / `medium` / `hard`，显示简单 / 中等 / 复杂         |
| tags                     | 可选 string[]；默认 []；最多 20 项，每项 trim 后 1～20 字且去重 |
| ingredients              | 必填非空 IngredientInput[]；最多 100 项                         |
| steps                    | 必填非空 StepInput[]；最多 100 项                               |
| tips                     | 可选 string；最多 5000 字                                       |
| source                   | 可选 string；自由文本或网址，最多 500 字；不服务端抓取          |

IngredientInput：`name` 必填、trim 后1～50字；`amount` / `unit` / `note` / `group` 可选字符串，上限分别为50 / 20 / 200 / 50字。Web表单把数量与单位合为一个输入框；纯数字输入时展示可滚动的下拉联想项，如“3个”“3克”“3勺”，选择后分别存入amount和unit。非建议单位仍可直接输入，如“2枚”；“适量”“少许”“2～3”等数量原样保留。数组顺序是展示顺序；group缺失的先展示，其余分组按首次出现顺序，组内保持原顺序。数量始终是字符串。

IngredientInput 另有 `scaleWithServings` 可选 boolean，省略默认 true；响应必有 boolean。它与 servings 都不是可清空的可选标量。false 表示保留原量，适用于部分油、水、调料。旧版 version=1 导入没有这两个字段时按默认值处理，不根据文本推断原份数。

StepInput：`order` 必填正整数，`text` 必填且trim后1～5000字；数组内order必须恰好是1…N且与数组顺序相同，不重复、不跳号。前端移动条目后重新编号，服务端不默默修复非法导入。

表单可选文本留空时省略；可选数字留空时省略而不是变成0；请求可选字段不使用null。原份数输入不得留空，范围1～100；接口省略servings / scaleWithServings分别默认1 / true。PUT是完整替换，省略其他可选字段表示清除，省略这两个默认字段则重置为默认值；编辑端必须显式提交已有值。响应缺失可选标量返回null，tags返回[]，servings / scaleWithServings始终非null。上述字段长度及数量上限统一由shared约束，不能不同页面各自定义。

### 3.1.1 份数换算

用户已确认：新增默认1人份但允许原份数；手机详情及发送弹层用 − / ＋ 调整每道目标份数，并发送到厨房。目标初始等于原份数，不是所有菜一律显示1。

- targetServings 为1～100正整数；下限/上限边界禁用按钮。它是本次阅读/做饭状态，不改变Recipe.servings，也不新增单独换算API。
- trim 后 amount 仅当匹配 `^\d+(?:\.\d+)?$` 且 scaleWithServings=true 才换算。负号、科学记数、范围、分数、单位混在amount内、空值、中文量词不解析，保留原文；合法数字0仍是0。
- 比例是 targetServings / Recipe.servings，始终从保存的原量重新算，不基于上次显示值累计，以免反复 + / − 产生误差。
- 原份数等于目标时原文不改。按精确十进制计算后四舍五入到最多2位小数并去尾零；结果发生舍入时标“约”。正值舍入后为0时显示“少于0.01”，不可显示0。数值输入受50字上限约束，使用无浮点累计误差的字符串/整数计算，不为此安装数学库。
- 个/枚等不自动向上取整，允许参考“1.5个”；用户自行分配。文字量与关闭换算项在目标不同时标“原量/按需调整”。
- 全部换算区显示“参考用量，调料按口味调整”。不解析步骤或tips中的“加10g盐”，不换算时间/火力，目标不同另提示“步骤与时间沿用原菜谱”。
- 将实际共享的纯换算/格式化规则放shared，Web详情/厨房复用；API存原量及目标份数，不把临时计算量覆盖进菜谱。既有 Schema 不包含这些业务字段，实施时才新增并测试。

### 3.2 Recipe / RecipeSummary

Recipe 是规范化后的完整输入加 `id`、`isLiked`、`createdAt`、`updatedAt`；不含 userId、密码或其他关系内部字段。RecipeSummary 只含 `id`、`isLiked`、`title`、`description`、`servings`、`prepMinutes`、`cookMinutes`、`difficulty`、`tags`、`updatedAt`，不传食材、步骤和 tips。

V2 已确认个人爱心：[A27](apis/A27_RECIPE_LIKE_PUT.md)，含义为“喜欢吃，也做得好吃”，列表和详情复用同一按钮，支持取消；不增加收藏列表/筛选、评分或随机权重。`isLiked`服务端实际输出布尔值，shared缺失时默认false以读取旧响应。旧菜谱、新增及导入默认false；普通编辑保留，RecipeInput与JSON/Excel导出不携带个人标记，爱心不修改updatedAt或厨房revision。当前设计PNG未包含爱心，不将旧图当作此新增状态的验收依据。

总时长不单独存储：两个时间均非 null 时相加，否则不显示“总时长”。单独的准备 / 烹饪时间可在详情中显示，0 不当作缺失。

[A14随机推荐](apis/A14_RECIPE_RANDOM_GET.md)复用RecipeSummary，只返回一道候选；成功类型为 `{ recipe: RecipeSummary, reason: null }` 或 `{ recipe: null, reason: "EMPTY_LIBRARY" | "NO_ALTERNATIVE" }`，实施时用shared联合Schema约束，不用宽泛可空字段放任无效组合。Query只允许可选excludeRecipeId，不带列表筛选，推荐不持久化、不写厨房。V2外卖候选是未来独立业务，不混入RecipeInput或厨房Contract。

以下作为 A04 / A05 / A06 的完整响应示例（不是预置数据库数据）：

```json
{
  "recipe": {
    "id": 101,
    "isLiked": false,
    "title": "番茄炒蛋",
    "description": "十分钟家常菜",
    "servings": 2,
    "prepMinutes": 5,
    "cookMinutes": 10,
    "difficulty": "easy",
    "tags": ["家常菜", "快手"],
    "ingredients": [
      {
        "name": "鸡蛋",
        "amount": "3",
        "unit": "个",
        "note": null,
        "group": null,
        "scaleWithServings": true
      },
      {
        "name": "番茄",
        "amount": "2",
        "unit": "个",
        "note": "切块",
        "group": null,
        "scaleWithServings": true
      },
      {
        "name": "盐",
        "amount": "适量",
        "unit": null,
        "note": null,
        "group": null,
        "scaleWithServings": true
      }
    ],
    "steps": [
      { "order": 1, "text": "鸡蛋打散，加少许盐。" },
      { "order": 2, "text": "热油下蛋液，凝固后盛出。" },
      { "order": 3, "text": "下番茄炒出汁，倒回鸡蛋翻匀。" }
    ],
    "tips": "番茄先用开水烫一下更容易去皮。",
    "source": null,
    "createdAt": "2026-10-08T05:00:00.000Z",
    "updatedAt": "2026-10-08T05:00:00.000Z"
  }
}
```

### 3.3 KitchenState

所有厨房读写成功统一返回 `{ session: KitchenSession, pollIntervalSeconds: number }`。KitchenSession：

| 字段           | 说明                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| recipeIds      | 去重且有序的 0～10 个菜谱 id                                                                                                                                        |
| items          | 与 recipeIds 同序的 `{ recipeId, targetServings }[]`；服务端保存目标，recipeIds由其派生，空菜单为 []                                                                |
| activeRecipeId | 非空菜单中恰好属于 recipeIds；空菜单时 null                                                                                                                         |
| revision       | 非负整数版本。初始空状态 0（未创建会话时GET及首次expectedRevision均为0）；成功替换菜单请求总是+1，切换仅在active变化时+1，非空清空/完成+1，空清空及选中当前菜不变更 |
| updatedAt      | 变更时间；初始未创建记录时 null                                                                                                                                     |
| recipes        | 按 recipeIds 排列的完整 Recipe[] 快照；空菜单为 []                                                                                                                  |

`pollIntervalSeconds` 默认 10，由后端 `KITCHEN_POLL_INTERVAL_SECONDS` 环境变量确定（正整数，范围 5～300），不是前端 VITE 配置副本。GET 返回空状态而不是 404；GET 不创建数据库记录。发送创建第一条记录。

厨房请求串行，不叠加轮询；回来前台立即重新读。厨房本地页码不写服务端，切换菜谱才写 activeRecipeId。切换不会标记菜已做完，菜单位置也不是已完成数量；没有逐道完成打勾，[A15](apis/A15_KITCHEN_COMPLETE_POST.md)“完成”才把整份菜单记为一顿历史并清空，[A13](apis/A13_KITCHEN_DELETE.md)只清空，不记。

版本用于并发控制，不能表示“屏幕已收到”。所有写入携带 `expectedRevision`；服务端原子比对当前版本，失配返回 409 SESSION_CONFLICT。手机打开弹层读取一次版本，厨房使用最近的成功响应版本。不自动重试带旧版本的写操作，不因轮询失败清空菜谱。

显示内容比较包含 recipes 的文字、顺序、items 的目标份数与当前菜，不能只比较 recipeIds / activeRecipeId；相同响应不重置 DOM 或页码。本机写入成功后更新本地版本，下一次轮询不能重复刷新。

发送Body使用items而不重复提交recipeIds，避免两份列表矛盾。每个recipeId只出现一次，targetServings必填1～100正整数；读取/切换/清空等成功响应都包含items，原Recipe.servings与amount仍是原值。厨房按items与Recipe共同计算显示。编辑原菜谱时保留会话目标份数，使用新原份数/原量重新计算；修改和删除仍同步revision及成员关系。

### 3.4 导入

请求是 `{ "version": 1, "recipes": [RecipeInput] }`，1～1000 条，总体最多 10 MiB（10,485,760 字节，UTF-8 请求体）；不使用 multipart、Base64、Excel 或图片。文件输入检查原始字节，粘贴检查 UTF-8 字节，API 最终检查 bodyLimit。导出复用 version 1 RecipeInput 数据结构，完整导出最多1000道且格式化JSON不超过10 MiB；超限明确失败，不返回部分菜库。

预校验成功返回 `{ valid: true, count: N, issues: [] }`；业务校验失败是 422，错误报告含全部可识别的问题，前端按 index +1 显示第几条。语法错误无法继续检查条目时为 400。

正式导入返回 `{ importedCount: N, recipeIds: number[] }`；顺序与输入一致。预校验不保存草稿、不生成 token，正式提交同一份输入并重新校验。用户修改文本后旧校验状态立即失效。

### 3.5 做饭历史

CookingHistory响应为 `{ id, cookedAt, source, items }`：id正整数、cookedAt服务端记录的ISO UTC时间、source为`kitchen`/`manual`，items为1～10条有序 `{ recipeId: 正整数 | null, title: string, targetServings: 1～100正整数 }`。title是当时菜名快照，份数是当次目标；manual仅1条，kitchen为完成时全菜单。

无userId、食材步骤、内部关系id或sourceSessionRevision，不保存完整Recipe副本；菜谱删除使recipeId=null，title/份数保留。查看链接访问最新Recipe，历史目标只初始化详情的本次显示份数。列表A16每页20次 `{ items: CookingHistory[], page, pageSize, hasMore }`；手动A17返回 `{ history: CookingHistory }`；删除A18返回204。shared Schema、Prisma模型与源码已实现；初始迁移已应用于本地开发数据库，A16只读路径已通过真实HTTP冒烟，写入及事务集成尚未验收。

历史与推荐/浏览记录无关。同日同菜多次做过可多条，V1无日期补录、编辑、统计和清空全部；删除误记整组不影响Recipe或KitchenState。手机主动查看历史，不通知/轮询。

## 4. 错误约定

延续已有错误 envelope：

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "请求参数不正确",
    "issues": [{ "path": ["ingredients", 0, "name"], "message": "请填写食材名" }]
  }
}
```

issues 可选；至少保证 path（string / number 数组）和 message。导入错误 path 从 `recipes` 开始，数组索引为 0-based；前端转换人类可读的 1-based 条目。不显示堆栈、SQL、数据库 URL、内部授权信息。现有 Zod issues 的额外字段不作为页面必需依赖。

| HTTP | code                            | 使用                                               |
| ---- | ------------------------------- | -------------------------------------------------- |
| 400  | INVALID_INPUT / INVALID_REQUEST | 参数不合法 / JSON 语法不合法                       |
| 404  | RECIPE_NOT_FOUND                | 菜谱不存在或不属于默认用户                         |
| 404  | COOKING_HISTORY_NOT_FOUND       | 历史不存在、已删或不属于默认用户                   |
| 409  | RECIPE_TITLE_CONFLICT           | 与现有菜名冲突                                     |
| 409  | SESSION_CONFLICT                | 厨房状态已变更，重新读取                           |
| 409  | KITCHEN_SESSION_EMPTY           | 当前为空，不能完成并创建空历史                     |
| 413  | PAYLOAD_TOO_LARGE               | 请求体超限                                         |
| 422  | IMPORT_VALIDATION_FAILED        | 导入条目、同名、版本校验未通过                     |
| 500  | INTERNAL_ERROR                  | 内部异常；服务端 Pino 记录                         |
| 503  | SERVICE_UNAVAILABLE             | 已识别的数据库不可用；日志明确，不能返回成功空列表 |

网络断开是前端请求失败，不伪造 HTTP 状态。POST / PUT / DELETE 响应丢失可能已经写入，提示“结果暂未确认，请重新查询”，不自动重复提交。厨房可以 GET 确认结果；若已空，仅显示待机而不杜撰完成通知。字段校验失败保留输入，500 / 503 不将错误当作空数据。

## 5. 数据与事务设计

Prisma Schema 已定义 Recipe（userId 外键，规范化 title 同用户唯一，servings默认1且不可空）、食材（scaleWithServings默认true）/ 步骤从属数据、KitchenSession（userId 唯一）、KitchenSessionRecipe（顺序、菜谱外键、targetServings为1～100正整数）、CookingHistory 与从属项。食材“内嵌”指业务随菜谱读写，不等于需要独立食材字典或强制使用 JSON 列。版本化迁移须在数据库环境可用后由 Prisma 工具生成和验收，当前没有迁移产物。

做饭历史再新增CookingHistory（userId、cookedAt、source、可空内部sourceSessionRevision）及从属项（顺序、可空Recipe外键、当时title、targetServings）。Recipe删除对历史项SetNull、保留名字/份数，不级联删历史；历史本身删除级联其项。厨房来源 `(userId, sourceSessionRevision)` 唯一防重复，手动null可多次；模型/约束/索引实施时通过版本化迁移建立，不在本次生成空迁移。

会话成员与 activeRecipeId 必须保持一致。替换会话、切换、清空/完成，以及影响会话的菜谱编辑 / 删除、手动历史写入，用同一用户的事务锁串行化（可锁既有默认 User 行），厨房写入事务内检查 revision；不采用“先 GET、后无条件 UPDATE”。A11每次接受替换请求均递增revision；A12同一active、A13空菜单不变revision。A15历史创建与菜单清空一个事务，不能分两次HTTP请求凑合；A13从不记历史。

- 编辑当前菜单中的菜谱也递增会话 revision，读接口在一致性事务快照内返回菜谱内容。
- 删除菜谱原子删除所属食材、步骤并移除会话成员。若删的是当前菜，选择剩余有序菜单第一道；无剩余则 activeRecipeId=null。否则保留当前菜。会话改变递增 revision。
- 新建与批量导入依靠数据库唯一约束兜底，不能只用“提交前查重”抵抗并发。
- 所有写入失败回滚，不吞掉数据库异常。集成测试使用独立测试数据库。

普通菜谱完整编辑采用最后一次成功保存为准（V1 没有协同编辑）。厨房版本保护是为防止手机 / 厨房同时操作造成菜单误清，不引入 Redis、消息队列或复杂同步框架。
