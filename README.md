# HTML Native Plugin

零依赖的 HTML 原生交互插件运行时。一份 `hnp.js` 加一个 `data-hnp`，静态 HTML 就长出标签页、筛选、对比滑块、决策卡、就地批注——**不装任何东西，双击就能用**。

- 零依赖、零构建即可运行：`<script src="src/hnp.js">` 之后就能用
- 12 个插件各是一个文件，用哪个引哪个
- 注册制内核：插件可单独挂载、单独卸载、重复挂载不重复绑定
- 单文件内联：构建一次即可离线分发，十年后仍能打开

## 30 秒跑通

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="src/hnp.css" />
</head>
<body>
  <div class="hnp-tabs" data-hnp="tabs">
    <div class="hnp-tabs__bar">
      <button class="hnp-tab" type="button">一</button>
      <button class="hnp-tab" type="button">二</button>
    </div>
    <div class="hnp-pane">第一页</div>
    <div class="hnp-pane">第二页</div>
  </div>

  <script src="src/hnp.js"></script>
  <script src="plugins/tabs.js"></script>
</body>
</html>
```

打开这个文件，标签页就能点了。没有 `npm install`，没有打包产物，没有服务器。

想看全部能力：直接双击 `demo/index.html`。

## 内置插件

| `data-hnp` | 做什么 | 声明位置 |
| --- | --- | --- |
| `theme` | 深/浅色切换，记忆在 `hnp:theme:mode` | 按钮 |
| `tone` | 专业 / 通俗双版表达切换 | 按钮 |
| `toc` | 目录跟随当前滚动位置 | 目录容器 |
| `tabs` | 标签页，支持左右方向键 | `.hnp-tabs` |
| `filter` | 按标签筛选，作用域收窄到 `[data-hnp-scope]` | 筛选条容器 |
| `reveal` | 渐入、数字滚动、条形生长，含兜底强制显示 | 区块容器 |
| `compare` | 前后对比滑块，可拖拽、可键盘 | `.hnp-cmp` |
| `decision` | 决策卡：单选 + 备注 + 落库 + 事件 | `.hnp-dcard` |
| `anno` | 就地批注：选中即批，导出台账 JSON | `body` |
| `scrolly` | 滚动叙事，滚动位置决定图板哪一帧 | `.hnp-scrolly` |
| `timeline` | 时间轴逐项点亮 | `.hnp-tl` |
| `copy-md` | 把正文转成 Markdown 复制走 | 按钮 |

一个容器可以同时挂多个插件：

```html
<div data-hnp="reveal filter">…</div>
```

## API 一览

```js
HNP.define(name, spec)          // 注册插件
HNP.use(name).mount(root)       // 按名取用
HNP.mount(root, {plugins})      // 扫描 [data-hnp] 挂载
HNP.unmount(root, name)         // 卸载并清理监听器
HNP.on(evt, fn) / HNP.emit()    // 事件总线
HNP.store('ns')                 // 带前缀、失败安全
HNP.copy(text)                  // 剪贴板
HNP.inspect()                   // 自检信息
```

完整接口见 [docs/api.md](docs/api.md)，写自己的插件见 [docs/plugin-spec.md](docs/plugin-spec.md)。

## 目录

```
src/hnp.js          内核：注册表 + 上下文 + 生命周期 + 事件总线
src/hnp.css         设计 token 与组件样式（类名统一 hnp- 前缀）
plugins/            12 个独立插件，每个一个文件
demo/index.html     全部能力的演示页，含自检面板
demo/single.html    构建产物：全内联单文件，可离线双击
build/inline.mjs    内联构建脚本
docs/               API 与插件规范
```

## 构建单文件版

```bash
node build/inline.mjs
```

把 `src/hnp.css` 与所引插件内联进 `demo/index.html`，输出 `demo/single.html`。脚本会检查 `</style>` / `</script>` 冲突，并报告未内联的外部引用。

## 设计约定

1. **内容先站住，交互后加**。没有 JS 时页面是完整的一篇，不是空白。
2. **坏插件不连坐**。单个插件挂载失败只 `console.warn`，其余照常。
3. **动画可停**。`prefers-reduced-motion: reduce` 下直接呈现终态。
4. **状态按插件隔离**。存储键统一 `hnp:<插件名>:` 前缀，多实例不互相踩。
5. **卸载要干净**。所有监听器经 `ctx.on` 登记，`unmount` 后点击无响应。

## 与 kunpeng-ops 的关系

交互层与设计 token 源自 [kunpeng-ops](https://github.com/JueMing2049/kunpeng-ops) 的 `html-report-kit`，本项目把它重构为注册制插件：从"一个 IIFE 按固定顺序 init 十四个模块"变成"谁需要谁声明、可挂可卸"。

两者互相独立，本项目不要求 kunpeng-ops 改动，kunpeng-ops 也不依赖本项目。

## License

MIT
