# 吃什么饭品牌图标

[Logo 原图](app-logo-v1.png)采用抽象饭碗和问号，沿用奶油黄与深棕配色。问号与米饭之间保留空隙，便于小尺寸辨认。

运行图标位于 `apps/web/public/icons/`：普通安装图标 192/512px，Android maskable 图标 512px，Apple touch 图标 180px，浏览器 favicon 32px。安装图标保留外围留白，供系统裁切。

生成提示词与两次修改的真实输入统一记录于[提示词文件](../screens/images/PROMPTS.md#app_icon)。后续替换需同时更新 Vite manifest、HTML 图标链接和项目地图。

已安装到桌面的旧图标可能仍有缓存；发布新版后可移除旧快捷方式并重新添加。实际 Android/iOS 桌面效果尚待真机验收。
