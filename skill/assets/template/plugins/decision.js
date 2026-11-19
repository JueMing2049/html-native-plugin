/* HNP 插件 · decision — 决策卡：单选 + 备注 + 落库，状态随实例走，产出走事件 */
(function () {
  'use strict';
  if (!window.HNP) return;

  HNP.define('decision', {
    mount: function (el, ctx) {
      var opts = Array.prototype.slice.call(el.querySelectorAll('.hnp-dopt'));
      var confirmBtn = el.querySelector('[data-act="confirm"]');
      var out = el.querySelector('.hnp-dcard__out');
      if (!opts.length) return;

      var id = el.getAttribute('data-id') || ('D-' + Math.random().toString(36).slice(2, 7));
      var title = el.getAttribute('data-title') || '';
      var record = null;

      ctx.on(el, 'click', function (e) {
        var opt = e.target.closest('.hnp-dopt');
        if (!opt) return;
        opts.forEach(function (o) { o.classList.remove('sel'); });
        opt.classList.add('sel');
        ctx.emit('decision:select', { id: id, key: opt.getAttribute('data-key') });
      });

      if (confirmBtn) {
        ctx.on(confirmBtn, 'click', function () {
          var sel = el.querySelector('.hnp-dopt.sel');
          var noteEl = el.querySelector('[data-note]');
          record = {
            id: id,
            title: title,
            choice: sel ? sel.getAttribute('data-key') : null,
            label: sel ? sel.textContent.trim().slice(0, 40) : null,
            note: noteEl ? (noteEl.value || null) : null,
            at: new Date().toISOString()
          };
          if (out) out.textContent = record.choice ? ('已记：' + record.label) : '请先选一项';
          el.style.borderColor = record.choice ? 'var(--jade)' : 'var(--red)';
          ctx.emit('decision:confirm', record);
        });
      }

      ctx.getRecord = function () { return record; };
    }
  });
})();
