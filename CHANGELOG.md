# CHANGELOG

版本规则：`主版本.次版本.修订号`。**插件名、CSS token 名、`HNP.define` 签名属于兼容承诺**，改动必须走主版本。

## 0.3.0

新增**图显前置模板**（`--template diagram-first`）：智能体应用开发前的工作台，先画五张图，再誊字段，导出范式包交给 `workswarm-app-builder`。

- 五阶段逐级解锁：定级 → 对标（BDMP）→ 画图 → 誊字段 → 导出。
- **按复杂度分级**：Quick 两张图一道门，Light 三张，Full 五张四道门。避免小需求被大流程压死。
- **五张图**：效果 / 流程 / 编排 / 架构 / **时序**（智能体特有：角色与回合收口）。
- **Diagram-as-Code**：图源是独立 `figures/*.svg`，可 diff、可替换工具，页面不绑死。
- 效果图三种来源：占位 / 上传 / 外部生图（模板不调模型，保持纯静态）。
- 导出 `diagram-first.json`（schema v1）与 `app-spec.md`；未完成只能导草稿。
- `scaffold.mjs` 新增 `--template`、`--list-templates`；模板页与 `figures/` 不进 lockfile，升级不覆盖。
- `build/inline.mjs` 新增 `--inline-svg`；`scaffold --single` 在模板模式下会连图源一起内联。

不改插件契约，`data-hnp` 名、CSS token 名、`HNP.define` 签名均未变动，0.2.x 项目可直接升级。

## 0.2.1

补齐对外协作所需的东西，并修掉 v0.2.0 的一个发布事故。

**修复：v0.2.0 的 `src/hnp.js` 与 `demo/index.html` 是坏的。** 发布时用 PowerShell 的 `Get-Content -Raw`（按 ANSI 解码 UTF-8）改版本号，把中文字符串写成了乱码，`hnp.js` 因此语法错误，页面完全跑不起来。本版从破坏前的提交取回原文，重写版本号。**用了 v0.2.0 的项目请升到本版**，或直接删掉 `src/` 重新生成。

协作相关：

- `CONTRIBUTING.md`：分流四类改动（样式 / 插件 / 契约 / 安装器），写明本地验证命令与 PR 规矩，列出"不接受"的三类。
- issue 模板：`报告问题`、`提新插件`、`改契约` 三种表单，禁用空 issue。改契约那版强制填"为什么不能新增"。
- CI：语法检查、模板与库同步校验、单文件产物是否最新、README 插件表是否漏项。
- `sync-template.mjs --check`：只校验不写盘，供 CI 使用（写入模式会改 `commit` 戳，在 PR 上必然制造假差异）。

## 0.2.0

新增「可升级分发」三件套。0.1.0 生成的项目可以继续用，但拿不到本版的便利。

- **单仓**：技能 `hnp-scaffold` 移入本仓 `skill/`，库与安装器同版本发布，不再靠手工复制。
- **模板自动生成**：`skill/assets/template/` 由 `skill/scripts/sync-template.mjs` 从仓内 `src/` 与 `plugins/` 产出，并写入 `assets/VERSION.json`（版本 + commit）。手抄副本这一环被移除。
- **用户样式层**：脚手架额外生成 `src/hnp-theme.css`，归使用者所有，升级永不覆盖。自定义颜色、间距、字体写在这里。
- **来源可追溯**：生成项目写入 `.hnp-lock.json`，记录 HNP 版本、上游 commit、每个文件的 sha256。
- **升级命令**：`skill/scripts/upgrade.mjs` 按 lockfile 比对，只替换使用者没动过的文件；动过的列出来并跳过，`--force` 才覆盖。

## 0.1.0

首个版本。零依赖运行时 `src/hnp.js`，12 个独立插件，设计 token 与组件样式 `src/hnp.css`，全内联单文件构建，演示页与自检面板。

- 修复：`reveal` 原先靠 `html.js` 类隐藏待渐入内容，未引入 reveal 插件的页面内容会消失。改为由插件挂载时加 `html.hnp-anim`，并带引用计数。
