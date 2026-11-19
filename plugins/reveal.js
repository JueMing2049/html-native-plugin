/* HNP 插件 · reveal — 渐入 / 数字滚动 / 条形生长；规则：宁可不动效，不可让内容消失 */
(function () {
  'use strict';
  if (!window.HNP) return;

  function countUp(node) {
    var targets = node.matches && node.matches('[data-hnp-count]')
      ? [node]
      : Array.prototype.slice.call(node.querySelectorAll('[data-hnp-count]'));
    targets.forEach(function (el) {
      if (el.dataset.hnpDone) return;
      el.dataset.hnpDone = '1';

      var target = parseFloat(el.getAttribute('data-hnp-count'));
      if (isNaN(target)) return;
      var dec = parseInt(el.getAttribute('data-hnp-dec') || '0', 10);
      var pre = el.getAttribute('data-hnp-pre') || '';
      var suf = el.getAttribute('data-hnp-suf') || '';
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduced) { el.textContent = pre + target.toFixed(dec) + suf; return; }

      var t0 = null, dur = 1100, done = false;
      var safety = setTimeout(finish, dur + 400);
      function finish() {
        if (done) return;
        done = true;
        clearTimeout(safety);
        el.textContent = pre + target.toFixed(dec) + suf;
      }
      function tick(ts) {
        if (done) return;
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = pre + (target * e).toFixed(dec) + suf;
        if (p < 1) requestAnimationFrame(tick);
        else finish();
      }
      requestAnimationFrame(tick);
    });
  }

  function growBars(node) {
    var bars = node.matches && node.matches('.hnp-bar')
      ? [node]
      : Array.prototype.slice.call(node.querySelectorAll('.hnp-bar'));
    bars.forEach(function (bar) {
      var w = bar.getAttribute('data-hnp-w');
      if (w) bar.style.setProperty('--w', w);
      bar.classList.add('in');
    });
  }

  HNP.define('reveal', {
    defaults: { delay: '1600' },
    mount: function (el, ctx) {
      var nodes = Array.prototype.slice.call(
        el.querySelectorAll('.hnp-reveal, [data-hnp-count], .hnp-bar')
      );
      if (el.matches && el.matches('.hnp-reveal')) nodes.unshift(el);
      if (!nodes.length) return;

      function show(node) {
        node.classList.add('in');
        countUp(node);
        growBars(node);
      }

      if (ctx.reducedMotion || !('IntersectionObserver' in window)) {
        nodes.forEach(show);
        return;
      }

      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          try { show(entry.target); } catch (e) { /* 单条失败不拖累其余 */ }
          io.unobserve(entry.target);
        });
      }, { threshold: 0.06, rootMargin: '0px 0px -6% 0px' });

      nodes.forEach(function (n) { ctx.observer(io, n); });

      // 兜底：观察器未按期回调时，强制显示首屏内容
      ctx.later(parseInt(ctx.opts.delay, 10) || 1600, function () {
        var vh = window.innerHeight || 800;
        nodes.forEach(function (n) {
          if (n.classList.contains('in')) return;
          if (n.getBoundingClientRect().top < vh * 1.05) show(n);
        });
      });
    }
  });
})();
