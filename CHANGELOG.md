# CHANGELOG

版本规则：`主版本.次版本.修订号`。**插件名、CSS token 名、`HNP.define` 签名属于兼容承诺**，改动必须走主版本。

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
