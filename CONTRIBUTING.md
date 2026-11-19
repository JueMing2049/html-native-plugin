# 参与改进

这个仓里有两样东西：**库**（`src/`、`plugins/`）和**安装器**（`skill/`）。它们同版本发布，所以改动只走这一个仓库。

## 先分清你要改的是哪一类

| 你想改什么 | 改哪里 | 要不要发 PR |
| --- | --- | --- |
| 我这个项目的配色、间距、字体 | 项目里的 `src/hnp-theme.css` | 不用，那是你的文件 |
| 某个交互行为不对、有 bug | `plugins/*.js`，或内核 `src/hnp.js` | 要 |
| 想加一种新交互 | `plugins/` 新文件 | 要 |
| 想改插件名、CSS 变量名、`HNP.define` 签名 | 全仓 | 要，且先开 issue 讨论 |
| 生成逻辑、参数、目录结构不好用 | `skill/scripts/` | 要 |

**不要**为了满足某一个项目的特殊样式去改 `src/hnp.css` 或 `plugins/`。那是所有人的默认值。你的定制属于 `hnp-theme.css`。

## 报 bug

开 issue 时请带上四样，缺一样通常都没法定位：

1. 版本：项目里 `.hnp-lock.json` 的 `hnp.version`（或页面控制台里 `HNP.version`）
2. 最小复现：一个能打开的 HTML，或直接说清"哪个 `data-hnp` 容器 + 怎么点"
3. 控制台原文：`[hnp]` 开头的警告尤其重要——插件挂载失败只 warn，不报错
4. 期望 vs 实际

如果你的浏览器打不开 `file://`，先起个静态服务再试，别把沙箱限制当成 bug 报上来。

## 提新插件

新插件是这套东西最欢迎的贡献，但有个门槛：**插件之间不许互相知道对方存在**。

写之前读 `docs/plugin-spec.md`，提交前逐条过这个清单：

- 只有一个全局 `HNP`，没有新增全局变量
- 所有监听器经 `ctx.on` 登记，`unmount` 后点击无响应
- `HNP.mount(document)` 连调三次，`HNP.inspect().installed` 不变（幂等）
- 两个实例同时存在时互不干扰
- `mount` 故意抛错时，页面其余插件正常
- `prefers-reduced-motion: reduce` 下无动画、内容不消失
- 插件名小写短横线，类名统一 `hnp-` 前缀，事件名 `插件名:动作`

同时要更新的地方（漏了 CI 不会拦，但会明显不完整）：

- `docs/plugin-spec.md` 自检清单
- `demo/index.html` 加一个演示区块
- `README.md` 的插件表
- `CHANGELOG.md` 记一条

## 改契约

下面三样是**兼容承诺**，改了别人升级后会静默失效，所以必须走主版本：

1. `data-hnp` 的插件名
2. `hnp.css` 里的 CSS 变量名
3. `HNP.define` / `mount` / `unmount` / `ctx` 的签名与语义

要动请先开 issue 说明"为什么非得改而不是新增"，讨论过了再提 PR。

## 本地怎么验

```bash
# 1. 语法
for f in src/*.js plugins/*.js build/*.mjs skill/scripts/*.mjs; do node --check "$f"; done

# 2. 模板是否与库同步（改了 src/ 或 plugins/ 之后必须重跑）
node skill/scripts/sync-template.mjs          # 重建并写版本戳
node skill/scripts/sync-template.mjs --check  # 只校验，CI 用这个

# 3. 单文件产物是否最新
node build/inline.mjs && git diff --exit-code demo/single.html

# 4. 实际点一遍
#    起个静态服务打开 demo/index.html（file:// 在沙箱里常被禁）
#    确认 HNP.inspect().installed 等于页面里挂的插件数，控制台无 error
```

改行为的话，别只看代码——**把页面打开点一遍**。这个项目的多数 bug 是"看起来对、点下去没反应"。

## PR 规矩

- CI 必须绿（语法 / 模板同步 / 单文件产物）
- `CHANGELOG.md` 加一条，说清改了什么、用户会遇到什么不同
- 一个 PR 只做一件事，不要夹带无关的格式化或重命名
- **不要提交 `demo/single.html` 的手改**、**不要手改 `skill/assets/template/`**：这两个都是产物。改源头，然后跑脚本重建

## 版本号怎么加

`主版本.次版本.修订号`，改 `VERSION` 文件即可，`sync-template.mjs --check` 会校验它和 `src/hnp.js` 里的常量、`skill/assets/VERSION.json` 是否一致。

- 修 bug、改文档 → 修订号 +1
- 新增插件、新增能力且不破坏兼容 → 次版本 +1，修订号归零
- 改上述三个契约之一 → 主版本 +1，后两段归零

## 不接受

- 为了某一份报告的排版去改全局样式
- 引入构建期依赖（这个项目的全部价值就是零依赖、双击能开）
- 只在 Chrome 上能跑的实现（`IntersectionObserver`、`prefers-reduced-motion` 缺失时必须降级）
