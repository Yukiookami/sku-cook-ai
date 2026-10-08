---
name: git-publish
description: '用户明确要求 Git 提交、commit、上传代码、push 或发布当前改动时使用；检查范围、验证、精确暂存、中文 Conventional Commit 并安全推送。'
disable-model-invocation: true
---

# Git 提交与上传

## 触发与边界

仅用户明确要求提交/上传时执行，创建此Skill不代表允许现在commit/push。只要求commit不push；“上传到Git”包含push，但目标不清楚须询问。不能自动force、amend、删除分支、重写历史或发布到不明仓库。

## 流程

1. 读全局规则和项目地图；`git --no-pager status --short`、`git branch --show-current`、`git remote -v`核对状态/分支/remote；避免展示含认证信息的URL。记录已有暂存/未暂存改动，不能取消他人暂存。
2. 明确本次提交文件/片段；混有其他改动时询问或分离，不默认把所有未跟踪内容都算本次。检查项目地图、需求/设计、依赖清单与lockfile是否同步。
3. 阅读本次diff，检查.env/密钥/数据/产物未进入范围。按代码影响执行最小验证；纯文档执行链接/地图/格式检查即可。失败不写“验证通过”，未经用户明确接受不能忽略失败继续提交。
4. `git add -- <明确路径>`或精确暂存片段；禁止默认`git add .`。检查`git --no-pager diff --cached --stat`与本次暂存内容。如果index有不属于本次的暂存，停止协调，不擅自混入commit或清掉。
5. 使用下面消息规则提交；提交后确认新commit及剩余状态。不要自动填用户git身份；未配置时询问用户。
6. 只有明确需要push时确认目标与上游，检查分支关系；普通`git push`，没有上游时使用用户确认的remote/branch。非快进失败停止说明，不force，不自动rebase别人提交。
7. 报告commit哈希、消息、验证、push目标/结果与剩余改动。commit成功但push失败要分开表述，不说“上传成功”。

## Commit 规则

格式：`type(scope): 中文动作与目的`，scope可省略，标题建议72字符内。

- type：feat / fix / refactor / test / docs / chore / build。
- scope：web / api / shared / db / tooling / ai等实际影响范围，不用emoji。
- 一次提交一个连贯变更；配套测试、设计/地图与lockfile同提交，不为了极小粒度拆坏依赖。
- 必要正文说明原因、影响与真实验证；破坏兼容只有确实发生时用BREAKING CHANGE。
- 不把密钥或真实用户数据写进消息。
- 用户未要求省略时在消息末尾保留协作署名：

```text
docs(ai): 建立项目规则与开发工作流

记录前后端约束、设计书实施流程及实际项目地图。
验证：自定义配置与地图检查通过。

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

此Skill不自动创建PR；需要PR时单独确认范围与目标。
