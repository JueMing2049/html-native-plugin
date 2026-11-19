/* HNP 插件 · compare — 前后对比滑块，支持拖拽与方向键 */
(function () {
  'use strict';
  if (!window.HNP) return;

  HNP.define('compare', {
    mount: function (el, ctx) {
      var handle = el.querySelector('.hnp-cmp__h');
      if (!handle) return;

      var dragging = false;
      var last = 50;

      function set(clientX) {
        var rect = el.getBoundingClientRect();
        if (!rect.width) return;
        var p = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
        last = p;
        el.style.setProperty('--cut', p + '%');
        handle.setAttribute('aria-valuenow', String(Math.round(p)));
      }

      handle.setAttribute('role', 'slider');
      handle.setAttribute('tabindex', '0');
      handle.setAttribute('aria-valuemin', '2');
      handle.setAttribute('aria-valuemax', '98');
      handle.setAttribute('aria-valuenow', '50');

      ctx.on(handle, 'pointerdown', function (e) {
        dragging = true;
        try { handle.setPointerCapture(e.pointerId); } catch (err) { /* 某些环境不支持捕获 */ }
        e.preventDefault();
      });
      ctx.on(handle, 'pointermove', function (e) { if (dragging) set(e.clientX); });
      ctx.on(handle, 'pointerup', function () { dragging = false; });
      ctx.on(handle, 'pointercancel', function () { dragging = false; });
      ctx.on(el, 'pointerdown', function (e) { if (e.target === el) set(e.clientX); });

      ctx.on(handle, 'keydown', function (e) {
        var step = e.key === 'ArrowRight' ? 4 : e.key === 'ArrowLeft' ? -4 : 0;
        if (!step) return;
        e.preventDefault();
        last = Math.max(2, Math.min(98, last + step));
        el.style.setProperty('--cut', last + '%');
        handle.setAttribute('aria-valuenow', String(Math.round(last)));
      });
    }
  });
})();
