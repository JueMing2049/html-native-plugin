---
name: hnp-scaffold
description: >-
  把 HNP（HTML 原生交互层）落进一个项目，并可选一步建成公开 GitHub 仓库与 GitHub Pages 演示。
  用户说"给这个项目加交互""做一个能点的静态 HTML""把报告/文档变成可交互页面""新建一个 HTML 原生交互项目"
  "接入 HNP"，或要求"点一下就把这些交互装到一个新仓库里"时使用。产出零依赖的原生 JS/CSS，
  读者不需要安装任何东西，双击 HTML 就能用。不适用于需要 npm 依赖、前端框架或服务端渲染的交互需求。
description_cn: >-
  为项目接入 HNP 零依赖 HTML 原生交互层（标签页、筛选、对比滑块、决策卡、就地批注、滚动叙事等 12 个插件），
  可选自动创建公开 GitHub 仓库、首次提交推送并开启 GitHub Pages。产出纯原生 HTML/CSS/JS，读者无需安装任何东西。
---

# HNP 接入（hnp-scaffold）

HNP 是一套零依赖的 HTML 原生交互层：一份 `hnp.js` 加一个 `data-hnp` 属性，静态页面就长出标签页、筛选、对比滑块、决策卡、就地批注。它的立场是**读者不需要安装任何东西**——不是 npm 包，不是浏览器插件，双击 HTML 就能用。所以这里的"接入"永远是往目标项目里放文件、写属性，而不是装依赖。

## 这套东西的三层

```
库仓库 html-native-plugin   契约本体（src/、plugins/、docs/）← 唯一真相源
  └─ skill/                 本技能，与库同版本发布；assets/template 是**生成物**
       └─ 目标项目          生成时的快照，用户可改自己的样式层
```

`assets/template/` 不要手改：它由 `scripts/sync-template.mjs` 从仓内 `src/` 与 `plugins/` 生成，并写入 `assets/VERSION.json`（版本 + commit）。手改模板等于又造一份副本，迟早和库漂移。

## 先判断是哪种场景

| 用户想要 | 做法 |
| --- | --- |
| 新建一个项目/仓库，带交互演示 | 场景 A：脚手架 + 建仓 + Pages，一条命令 |
| 给**已有**项目加交互 | 场景 B：只落文件，`--no-demo`，然后按 `references/blocks.md` 给容器加属性 |
| 只要一个能发出去的单文件 HTML | 场景 C：`--single`，产出全内联的 `demo/single.html` |

拿不准时先问一句"是新建项目，还是接到现有项目里"。这决定要不要建仓、要不要生成 demo。

## 场景 A：新项目 + 公开仓库 + Pages

```bash
node <SKILL_ROOT>/scripts/scaffold.mjs \
  --dir <目标目录> \
  --title "<演示页标题>" \
  --git --publish --repo-name <仓库名> --repo-desc "<仓库描述>"
```

执行链：落文件 → 生成 demo → `git init` + 首次提交 → 建公开仓库 → 推送 → 开 Pages。成功后输出 `REPO=` 与 `PAGES=` 两行地址。

**建仓这一步会真的在你的账号下创建公开仓库**，所以执行前把仓库名和描述跟用户对一遍；仓库名已存在时脚本会直接失败退出，不会覆盖。用户明确说"先别建仓"时，去掉 `--publish` 只做本地部分。

## 场景 B：接进已有项目

```bash
node <SKILL_ROOT>/scripts/scaffold.mjs \
  --dir <已有项目目录> --no-demo --plugins tabs,filter,anno
```

只放 `src/hnp.js`、`src/hnp.css` 和选中的插件，不动目标项目原有文件（如果已存在 `src/hnp.js` 会拒绝执行，需要 `--force` 才覆盖，这是为了防止把别人已有的接入一键冲掉）。

接着要在页面里插标签。**顺序不能反**：`hnp.js` 必须在所有插件之前，因为插件靠运行时提供的 `HNP.define` 注册。

```html
<link rel="stylesheet" href="src/hnp.css" />
<link rel="stylesheet" href="src/hnp-theme.css" />
...
<script src="src/hnp.js"></script>
<script src="plugins/tabs.js"></script>
```

样式分两层：`src/hnp.css` 是上游文件，升级整份替换，不要改；用户的配色、间距、字体写进 `src/hnp-theme.css`，升级永远不碰。**遇到用户说"想改个风格"，先指到 theme 层，不要提议改 hnp.css。**

然后给容器加 `data-hnp`。每个插件要求的 DOM 结构不同，**读 `references/blocks.md`** 拿对应片段，不要凭记忆写类名——类名写错不会报错，只会静默无效果。

## 场景 C：单文件

在场景 A 或 B 的基础上加 `--single`，得到 `demo/single.html`：CSS 与全部脚本内联，断网、邮件附件、十年后打开都还能跑。适合"要发给别人看的报告"，不适合当项目源码。

## 场景 D：升级已有项目

生成时写过 `.hnp-lock.json`，记着 HNP 版本、上游 commit 和每个文件的哈希。升级靠它判断"哪些文件用户没动过"：

```bash
node <SKILL_ROOT>/scripts/upgrade.mjs --dir <项目>            # 默认只预览
node <SKILL_ROOT>/scripts/upgrade.mjs --dir <项目> --apply    # 执行
```

- 哈希与锁一致 → 用户没动过 → 替换
- 哈希不一致 → 用户改过 → 跳过并列出来，`--force` 才覆盖
- `src/hnp-theme.css` → 永不参与升级
- 没有 lockfile（0.2.0 之前生成的项目）→ 直接拒绝，不做猜测性覆盖

**不要用"重新跑 scaffold"当升级手段**：那会覆盖用户改过的文件，也拿不到差异清单。重跑只适合 `--force` 修复被改坏的情况。

## 维护这个技能本身（改库之后）

改完库里的 `src/` 或 `plugins/`，按顺序做两件事，否则发出去的还是旧代码：

```bash
node skill/scripts/sync-template.mjs   # 从仓内源码重建模板 + 写 VERSION.json
```

然后在 `CHANGELOG.md` 记一条、按 `VERSION` 规则改版本号、打 tag。**插件名、CSS token 名、`HNP.define` 签名是兼容承诺**，动它们必须升主版本，否则用户升级后静默失效。

装到本地技能目录属于"安装"，不是源码：改完 `skill/` 要把它同步到 `~/.jiuwenswarm/agent/workspace/skills/hnp-scaffold/`，并确认 `assets/VERSION.json` 的版本对得上。

## 参数

| 参数 | 说明 |
| --- | --- |
| `--dir <path>` | 目标目录，必需，不存在会自动创建 |
| `--plugins a,b,c` | 要落地的插件，默认全部 12 个 |
| `--title <str>` | demo 页标题 |
| `--no-demo` | 不生成 `demo/` |
| `--single` | 额外产出全内联 `demo/single.html` |
| `--git` | 初始化仓库并首次提交（已在 Git 仓库内则跳过 init，只提示） |
| `--force` | 允许覆盖已存在的 `src/hnp.js` |
| `--publish` | 建 GitHub 仓库并推送 |
| `--repo-name` / `--repo-desc` | 仓库名与描述，仓库名默认取目录名 |
| `--no-pages` | 建仓但不开 Pages |
| `--private` | 建私有仓库（默认公开） |

12 个插件：`theme` `tone` `toc` `tabs` `filter` `reveal` `compare` `decision` `anno` `scrolly` `timeline` `copy-md`。

## 发布行为的边界

- 凭据从 Windows 凭据管理器读 `git:https://github.com`，只在该 PowerShell 进程内存里用一次；token 通过环境变量喂给 git，**不写进 `.git/config`、不进 remote URL、不落盘**。
- 推送用 `http.extraHeader` + `GIT_CONFIG_VALUE_0`，避免 token 出现在命令行参数与 `.git/config`。
- 同名仓库存在时直接失败，不删除、不覆盖。
- 只创建仓库、推送、开关 Pages；不建组织、不改账号设置、不给他人授权。

如果发布失败，先看输出里的 `REASON=`：`no github token found` 说明这台机器没存凭据，需要用户先配一次 git 凭据；`already exists` 说明换个仓库名。

## 落地后怎么验收

不要只说"已生成"。至少确认：

1. `node --check` 过一遍目标里的 `src/hnp.js` 与 `plugins/*.js`（语法错会在这里暴露）
2. 打开 `demo/index.html`，控制台无 error；`HNP.inspect()` 的 `installed` 等于选中插件数
3. 逐个点一下选中插件的交互（标签页切换、筛选后条目数变化、批注浮标出现）
4. 有 `--single` 时，检查 `single.html` 里 `<script src=` 与 `<link ` 的出现次数为 0
5. 有 `--publish` 时，访问 `REPO=` 与 `PAGES=` 地址确认可打开

浏览器打不开 `file://` 的环境（沙箱常这样）就先起个本地静态服务再验，别用"应该没问题"代替实测。

## 参考

- `references/blocks.md` — 每个插件要求的 HTML 结构与类名，按需读对应小节
- `references/pitfalls.md` — 接入既有项目时反复踩到的坑，首次接入前读一遍
- `scripts/scaffold.mjs` — 落文件与建仓的实现，改行为改这里
- `scripts/upgrade.mjs` — 按 lockfile 增量升级，只动用户没改过的文件
- `scripts/sync-template.mjs` — 从仓内 `src/`、`plugins/` 重建 `assets/template` 并写版本戳
- `scripts/publish.ps1` — 建仓/推送/Pages 的 PowerShell 实现（源码保持 ASCII，非 ASCII 文案走 UTF-8 payload 文件）
