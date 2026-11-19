/* HNP 插件 · tone — 专业 / 通俗双版表达切换，作用于 [data-pro] / [data-plain] */
(function () {
  'use strict';
  if (!window.HNP) return;

  HNP.define('tone', {
    defaults: { key: 'tone', pro: '专业版', plain: '通俗版' },
    mount: function (el, ctx) {
      var root = document.documentElement;
      var saved = ctx.store.get(ctx.opts.key, null);
      if (saved === 'pro' || saved === 'plain') root.setAttribute('data-tone', saved);

      function paint() {
        var plain = root.getAttribute('data-tone') === 'plain';
        el.textContent = plain ? ctx.opts.pro : ctx.opts.plain;
        el.setAttribute('aria-pressed', plain ? 'true' : 'false');
        el.setAttribute('title', plain ? '当前通俗表达，点击切回专业' : '当前专业表达，点击切通俗');
      }

      paint();
      ctx.on(el, 'click', function () {
        var next = root.getAttribute('data-tone') === 'plain' ? 'pro' : 'plain';
        root.setAttribute('data-tone', next);
        ctx.store.set(ctx.opts.key, next);
        paint();
        ctx.emit('tone:change', { tone: next });
      });
    }
  });
})();
