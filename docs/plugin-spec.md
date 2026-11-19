# 插件规范

写一个 HNP 插件只需要一个 `HNP.define` 调用。本文是写第三方插件时的约束清单。

## 最小形态

```js
(function () {
  'use strict';
  if (!window.HNP) return;

  HNP.define('myplugin', {
    mount: function (el, ctx) {
      ctx.on(el, 'click', function () {
        el.classList.toggle('is-open');
        ctx.emit('myplugin:toggle', { open: el.classList.contains('is-open') });
      });
    }
  });
})();
```

页面上一句 `<div data-hnp="myplugin">` 即可生效。

## 命名

- **插件名**：小写，短横线分词（`copy-md`、`scrolly`）。它就是 `data-hnp` 里写的那个词，也是 `data-hnp-*` 选项属性的来源。
- **类名**：一律 `hnp-` 前缀加插件名，例如 `hnp-anno-basket`。不加前缀会污染宿主页面的样式空间。
- **事件名**：`插件名:动作`，例如 `decision:confirm`。
- **存储键**：不要自己拼 `localStorage` key，用 `ctx.store`，它自带 `hnp:<插件名>:` 前缀。

## 监听器与清理

所有监听器必须经 `ctx.on(target, type, fn, opts)` 登记：

```js
ctx.on(window, 'scroll', onScroll, { passive: true });
```

`ctx.on` 内部保存了对称的 `removeEventListener`，`unmount` 时由 `ctx.dispose()` 统一执行。直接 `addEventListener` 而不登记，等于制造内存泄漏，且卸载后仍会响应。

定时器用 `ctx.every` / `ctx.later`，IntersectionObserver 用 `ctx.observer`，同理。

`spec.unmount(el, ctx)` 只用来清理**监听器之外的副作用**：删除动态插入的 DOM、移除加上的类名、清掉内联样式。监听器清理不要重复写在里面。

## 状态归属

- 状态放在 `mount` 的闭包里，不要放模块级变量。模块级变量会让同一插件的两个实例共享一份状态。
- 需要跨实例共享时，走 `HNP.emit` + `HNP.on`，让使用者决定怎么汇总。
- 需要持久化时用 `ctx.store`，并且**默认值必须给**。

## 选项

```js
HNP.define('demo', {
  defaults: { offset: '150' },
  mount: function (el, ctx) {
    var offset = parseInt(ctx.opts.offset, 10) || 150;
  }
});
```

页面侧：

```html
<div data-hnp="demo" data-hnp-offset="200" />
```

`data-hnp-offset` 会以 `offset` 进入 `ctx.opts`（连字符自动转小驼峰），覆盖 `defaults`。所有选项值是**字符串**，自己转类型。

## 幂等

内核已经保证同一元素同一插件只挂一次，插件内部不必再写"已初始化"标记。但如果插件会操作共享资源（例如轮询、全局 observer），仍应在 `unmount` 里释放干净。

## 降级

三条硬要求：

1. `mount` 里任何可能抛错的地方自己 `try/catch`，不要让异常冒到内核——虽然内核会兜住，但你的插件实例会被整体回滚。
2. 动画/滚动类插件必须读 `ctx.reducedMotion`，为真时直接呈现终态。
3. 内容**不可**因为脚本未运行而消失。做法是 CSS 里默认可见，靠 `.js` 类名（页面头部加）才切换到"待渐入"状态。

```css
.js .hnp-reveal{opacity:0}
html:not(.js) .hnp-reveal{opacity:1;transform:none}
```

## 自检清单

提交前逐条过：

- [ ] 只用一个全局 `HNP`，没有新增全局变量
- [ ] 所有监听器经 `ctx.on`，卸载后点击无响应
- [ ] `HNP.mount` 连调三次，`HNP.inspect().installed` 不变
- [ ] 两个实例同时存在时互不干扰（改 A 不影响 B）
- [ ] `mount` 故意抛错时，页面其余插件正常
- [ ] `prefers-reduced-motion: reduce` 下无动画、内容完整
- [ ] 断网打开单文件版，行为与联机一致
