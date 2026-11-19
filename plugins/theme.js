/* HNP 插件 · theme — 深/浅色切换，记忆在 hnp:theme:* */
(function () {
  'use strict';
  if (!window.HNP) return;

  HNP.define('theme', {
    defaults: { key: 'mode', dark: '深色', light: '浅色' },
    mount: function (el, ctx) {
      var root = document.documentElement;
      var saved = ctx.store.get(ctx.opts.key, null);
      if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);

      function paint() {
        var dark = root.getAttribute('data-theme') !== 'light';
        el.textContent = dark ? ctx.opts.light : ctx.opts.dark;
        el.setAttribute('aria-pressed', dark ? 'true' : 'false');
        el.setAttribute('title', dark ? '当前深色，点击切浅色' : '当前浅色，点击切深色');
      }

      paint();
      ctx.on(el, 'click', function () {
        var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        root.setAttribute('data-theme', next);
        ctx.store.set(ctx.opts.key, next);
        paint();
        ctx.emit('theme:change', { theme: next });
      });
    }
  });
})();
