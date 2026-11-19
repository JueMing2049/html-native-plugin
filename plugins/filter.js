/* HNP 插件 · filter — 标签筛选，作用域收窄到最近的 [data-hnp-scope] */
(function () {
  'use strict';
  if (!window.HNP) return;

  HNP.define('filter', {
    defaults: { scope: '', key: 'tags' },
    mount: function (el, ctx) {
      var chips = Array.prototype.slice.call(el.querySelectorAll('.hnp-chip'));
      if (!chips.length) return;

      var zone = ctx.opts.scope
        ? document.querySelector(ctx.opts.scope)
        : (el.closest('[data-hnp-scope]') || document);
      if (!zone) return;

      var items = Array.prototype.slice.call(zone.querySelectorAll('[data-hnp-' + ctx.opts.key + ']'));

      function apply(k) {
        items.forEach(function (item) {
          var tags = (item.getAttribute('data-hnp-' + ctx.opts.key) || '').split(/\s+/);
          var hit = k === 'all' || tags.indexOf(k) > -1;
          item.style.display = hit ? '' : 'none';
        });
        ctx.emit('filter:change', { key: k, shown: items.filter(function (i) { return i.style.display !== 'none'; }).length });
      }

      chips.forEach(function (chip) {
        ctx.on(chip, 'click', function () {
          chips.forEach(function (c) { c.classList.remove('on'); });
          chip.classList.add('on');
          apply(chip.getAttribute('data-k') || 'all');
        });
      });
    }
  });
})();
