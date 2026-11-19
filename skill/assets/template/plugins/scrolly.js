/* HNP 插件 · scrolly — 滚动叙事：滚动位置决定右侧图板显示哪一帧 */
(function () {
  'use strict';
  if (!window.HNP) return;

  HNP.define('scrolly', {
    mount: function (el, ctx) {
      var steps = Array.prototype.slice.call(el.querySelectorAll('.hnp-step'));
      var graphic = el.querySelector('.hnp-scrolly__g');
      if (!steps.length || !graphic) return;

      var figs = Array.prototype.slice.call(graphic.querySelectorAll('[data-hnp-fig]'));

      function activate(index) {
        steps.forEach(function (s) { s.classList.remove('on'); });
        if (steps[index]) steps[index].classList.add('on');
        graphic.setAttribute('data-state', String(index + 1));
        figs.forEach(function (f) {
          f.style.display = f.getAttribute('data-hnp-fig') === String(index + 1) ? '' : 'none';
        });
        ctx.emit('scrolly:step', { index: index });
      }

      if (ctx.reducedMotion || !('IntersectionObserver' in window)) {
        steps.forEach(function (s) { s.classList.add('on'); });
        figs.forEach(function (f) { f.style.display = ''; });
        return;
      }

      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var i = steps.indexOf(entry.target);
          if (i > -1) activate(i);
        });
      }, { rootMargin: '-45% 0px -45% 0px' });

      steps.forEach(function (s) { ctx.observer(io, s); });
      activate(0);
    }
  });
})();
