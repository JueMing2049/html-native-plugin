# HNP API

全库只暴露一个全局对象 `HNP`。加载顺序：先 `src/hnp.js`，再各插件文件；插件通过 `HNP.define` 自行注册。

## 常量与命名空间

| 名称 | 说明 |
| --- | --- |
| `HNP.version` | 运行时版本，如 `"0.1.0"` |
| `window.HNP` | 唯一全局。不写 `window.Kit`、不挂其他全局 |

## 插件管理

### `HNP.define(name, spec)`

注册一个插件。同名重复注册会覆盖并 `console.warn`。

```js
HNP.define('tabs', {
  defaults: { delay: '0' },          // 可选：默认选项
  mount: function (el, ctx) { … },   // 必填
  unmount: function (el, ctx) { … }  // 可选：清理非监听器副作用（DOM、类名）
});
```

返回 `true` / `false`。`spec.mount` 缺失时拒绝注册。

### `HNP.use(name)`

按名取用，返回 `{ mount(root) }`。

```js
HNP.use('tabs').mount(document.getElementById('only-here'));
```

### `HNP.mount(root, options)`

扫描 `root` 内所有 `[data-hnp]`，按属性里列出的名字逐个挂载，返回本次新挂载的实例数。

- `root` 省略时等价于 `document`
- `options.plugins` 限定只挂载指定插件：`HNP.mount(document, { plugins: ['tabs'] })`
- 同一元素同一插件重复挂载**不会**产生第二个实例（幂等）

### `HNP.unmount(root, name)`

卸载 `root` 范围内的实例。`name` 省略则卸载全部。返回被卸载的数量。

`unmount` 会依次执行：插件自己的 `unmount(el, ctx)` → `ctx.dispose()`（清空所有经 `ctx.on` 登记的监听器）→ 从登记表移除。

### `HNP.plugins()` / `HNP.defined(name)`

列出已注册插件名 / 判断某插件是否已注册。

### `HNP.inspect()`

自检信息，用于 demo 与测试：

```js
{
  version: "0.1.0",
  registered: ["theme", "tone", …],
  installed: 14,
  byName: { tabs: 1, anno: 1, … }
}
```

## 事件总线

### `HNP.on(evt, fn)` / `HNP.off(evt, fn)` / `HNP.emit(evt, payload)`

`HNP.on` 返回一个取消订阅的函数。订阅 `'*'` 可收到所有事件（形如 `{ type, payload }`）。订阅者抛错只 `warn`，不影响其他订阅者与主流程。

内置事件：

| 事件 | 载荷 |
| --- | --- |
| `hnp:ready` | `{ version, mounted, auto }` |
| `hnp:mount` / `hnp:unmount` | `{ name, el }` |
| `theme:change` | `{ theme: "dark" \| "light" }` |
| `tone:change` | `{ tone: "pro" \| "plain" }` |
| `tabs:change` | `{ index, el }` |
| `filter:change` | `{ key, shown }` |
| `decision:select` | `{ id, key }` |
| `decision:confirm` | `{ id, title, choice, label, note, at }` |
| `anno:add` / `anno:remove` | 批注对象 / 被删对象 |
| `anno:export` | `{ doc, annotations, exportedAt }` |
| `scrolly:step` | `{ index }` |
| `copy-md:done` | `{ source }` |

## 存储与工具

### `HNP.store(namespace)`

带 `hnp:<namespace>:` 前缀的安全存储，`localStorage` 不可用（隐私模式、配额满）时静默降级，不抛错。

```js
var s = HNP.store('myns');
s.get('k', 默认值); s.set('k', 值); s.remove('k');
s.getJSON('k', {}); s.setJSON('k', {});
```

### `HNP.copy(text)`

写剪贴板，`navigator.clipboard` 不可用时退到 `execCommand('copy')`。

## 插件上下文 `ctx`

`mount(el, ctx)` 的第二个参数。**所有监听器都必须经 `ctx.on` 登记**，否则 `unmount` 清不掉。

| 成员 | 说明 |
| --- | --- |
| `ctx.name` / `ctx.el` | 插件名 / 挂载元素 |
| `ctx.opts` | `defaults` 与元素上 `data-hnp-*` 属性的合并结果（属性优先，自动转小驼峰） |
| `ctx.document` | `document` |
| `ctx.reducedMotion` | 挂载时的 `prefers-reduced-motion` 判定 |
| `ctx.emit(evt, payload)` | 等价 `HNP.emit` |
| `ctx.store` | 等价 `HNP.store(ctx.name)` |
| `ctx.on(target, type, fn, opts)` | 登记监听器，随 `dispose` 自动移除 |
| `ctx.every(ms, fn)` / `ctx.later(ms, fn)` | 登记定时器，随 `dispose` 清除 |
| `ctx.observer(io, target)` | 登记 IntersectionObserver 观察，随 `dispose` 解除 |
| `ctx.dispose()` | 手工清空（一般由内核调用） |

## 自动挂载

`DOMContentLoaded` 时自动执行一次 `HNP.mount(document)`。

要完全手动控制，在 `<html>` 上写 `data-hnp-auto="false"`，之后自行调用 `HNP.mount`。

## 降级契约

1. 单个插件 `mount` 抛错：`console.warn`，该插件实例被回滚，**其余插件照常挂载**
2. `IntersectionObserver` 缺失或 `prefers-reduced-motion: reduce`：动画类插件直接呈现终态，内容不隐藏
3. `localStorage` / 剪贴板不可用：静默降级，不阻断交互
