# 每个插件要求的 HTML 结构

类名写错不会报错，只会静默无效果——所以接新页面时照抄这里，不要凭记忆。所有类名统一 `hnp-` 前缀。

通用规则：容器上写 `data-hnp="插件名"`，多个用空格分隔。运行时在 `DOMContentLoaded` 自动挂载，无需手写调用。

---

## theme / tone

挂在**按钮**上，作用对象是 `<html>`。

```html
<button class="hnp-btn" type="button" data-hnp="theme">浅色</button>
<button class="hnp-btn" type="button" data-hnp="tone">通俗版</button>
```

`theme` 切换 `html[data-theme="dark|light"]`，`tone` 切换 `html[data-tone="pro|plain"]`。样式侧自己写对应规则，例如：

```css
html[data-tone="plain"] .pro-only{display:none}
html[data-tone="pro"] .plain-only{display:none}
```

记忆键：`hnp:theme:mode`、`hnp:tone:tone`。

## toc

挂在**含锚点链接的容器**上，链接指向真实存在的 `id`。

```html
<nav class="hnp-toc" data-hnp="toc">
  <a href="#s1">第一节</a>
  <a href="#s2">第二节</a>
</nav>
```

可选 `data-hnp-offset="150"` 调整判定线（默认 150px）。页面内容太短时只会有第一条常亮——那是滚动位置不够，不是故障。

## tabs

```html
<div class="hnp-tabs" data-hnp="tabs">
  <div class="hnp-tabs__bar">
    <button class="hnp-tab" type="button">一</button>
    <button class="hnp-tab" type="button">二</button>
  </div>
  <div class="hnp-pane">第一页内容</div>
  <div class="hnp-pane">第二页内容</div>
</div>
```

`.hnp-tab` 与 `.hnp-pane` **按下标配对**，数量要一致。方向键左右可切换。

## filter

需要两层：作用域容器 + 条目各自带标签。

```html
<div data-hnp-scope>
  <div data-hnp="filter">
    <div class="hnp-chips">
      <button class="hnp-chip on" type="button" data-k="all">全部</button>
      <button class="hnp-chip" type="button" data-k="a">甲类</button>
    </div>
    <div data-hnp-tags="a">甲类条目</div>
    <div data-hnp-tags="a b">甲乙都算</div>
  </div>
</div>
```

条目用 `data-hnp-tags="空格分隔的标签"`，筛选键对应 `data-k`。`data-hnp-scope` 决定"筛选谁"，页面有多组筛选时**必须各自包一层**，否则会互相清空。标签属性名可用 `data-hnp-key` 改写。

## reveal

```html
<section data-hnp="reveal">
  <div class="hnp-reveal">渐入内容</div>
  <span data-hnp-count="128" data-hnp-dec="0" data-hnp-pre="" data-hnp-suf="+">0</span>
  <div class="hnp-bar" data-hnp-w="86%"></div>
</section>
```

- `.hnp-reveal` 进视口后加 `.in`
- `data-hnp-count` 目标数字，`data-hnp-dec` 小数位，`data-hnp-pre` / `data-hnp-suf` 前后缀
- `.hnp-bar` 进视口后生长到 `--w`

**内容安全**：只有本插件挂载后才会给 `<html>` 加 `.hnp-anim` 类，隐藏规则全部收在该类下。只引 CSS 不引本插件时，`.hnp-reveal` 默认可见，不会出现空白。

## compare

```html
<div class="hnp-cmp" data-hnp="compare">
  <div class="hnp-cmp__a">改之前</div>
  <div class="hnp-cmp__b">改之后</div>
  <div class="hnp-cmp__h" title="拖动对比"></div>
</div>
```

`__a` 在下层、`__b` 在上层被 `clip-path` 裁切，`__h` 是拖拽把手。支持方向键。

## decision

```html
<div class="hnp-dcard" data-hnp="decision" data-id="D-1" data-title="要不要现在定">
  <div class="hnp-dcard__q">问题文字</div>
  <div class="hnp-dopts">
    <button class="hnp-dopt" type="button" data-key="yes">现在定</button>
    <button class="hnp-dopt" type="button" data-key="later">下一轮</button>
  </div>
  <input data-note type="text" placeholder="补一句理由（可选）" />
  <div class="hnp-dcard__f">
    <button class="hnp-btn pri" type="button" data-act="confirm">记下这个决定</button>
    <span class="hnp-dcard__out"></span>
  </div>
</div>
```

确认后发 `decision:confirm` 事件，载荷 `{id, title, choice, label, note, at}`。要跨页汇总就用 `HNP.on('decision:confirm', ...)` 自己收。

## anno

挂在 **`<body>`** 上，正文里给可批注的块加 `data-block`。

```html
<body data-hnp="anno">
  <section data-block="k-01-背景">…</section>
</body>
```

选中 `data-block` 块内的文字即浮出「＋ 批注」。导出 JSON 的结构：

```json
{ "doc": "页面标题", "annotations": [
  { "id": "A-1", "block": "k-01-背景", "quote": "被选中的原文",
    "type": "agree|reject|hold|delegate|note",
    "note": "你的意见", "rect": [x, y, w, h], "at": "ISO 时间" } ],
  "exportedAt": "ISO 时间" }
```

## scrolly

```html
<div class="hnp-scrolly" data-hnp="scrolly">
  <div>
    <div class="hnp-step"><h4>一</h4><p>…</p></div>
    <div class="hnp-step"><h4>二</h4><p>…</p></div>
  </div>
  <div class="hnp-scrolly__g">
    <div data-hnp-fig="1">第一帧图板</div>
    <div data-hnp-fig="2">第二帧图板</div>
  </div>
</div>
```

第 N 个 `.hnp-step` 进入视口中带时，显示 `data-hnp-fig="N"` 的图板。

## timeline

```html
<div class="hnp-tl" data-hnp="timeline">
  <div class="hnp-tl__i">
    <div class="hnp-tl__d">STEP 01</div>
    <div class="hnp-tl__t">标题</div>
    <p class="hnp-tl__p">正文</p>
  </div>
</div>
```

## copy-md

挂在按钮上，取 `#hnp-md-source` 的正文转 Markdown，没有则退到 `<main>`。

```html
<button class="hnp-btn" type="button" data-hnp="copy-md">复制 Markdown</button>
<main id="hnp-md-source">…</main>
```

要排除某些区块不被复制，给它加 `data-hnp-skip`。可用 `data-hnp-source="#选择器"` 改源。
