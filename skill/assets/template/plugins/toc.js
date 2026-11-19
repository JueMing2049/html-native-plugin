/* HNP 插件 · toc — 目录跟随（scrollspy） */
(function () {
  'use strict';
  if (!window.HNP) return;

  HNP.define('toc', {
    defaults: { offset: '150' },
    mount: function (el, ctx) {
      var links = Array.prototype.slice.call(el.querySelectorAll('a[href^="#"]'));
      if (!links.length) return;

      var secs = links.map(function (a) {
        return document.getElementById(a.getAttribute('href').slice(1));
      });
      var offset = parseInt(ctx.opts.offset, 10) || 150;

      function onScroll() {
        var y = (window.scrollY || window.pageYOffset) + offset;
        var idx = 0;
        for (var i = 0; i < secs.length; i++) {
          if (secs[i] && secs[i].offsetTop <= y) idx = i;
        }
        links.forEach(function (a, i) { a.classList.toggle('on', i === idx); });
      }

      ctx.on(window, 'scroll', onScroll, { passive: true });
      ctx.on(window, 'resize', onScroll, { passive: true });
      onScroll();

      ctx.clearMarks = function () {
        links.forEach(function (a) { a.classList.remove('on'); });
      };
    },
    unmount: function (el, ctx) {
      if (ctx.clearMarks) ctx.clearMarks();
    }
  });
})();
