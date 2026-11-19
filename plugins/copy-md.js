/* HNP 插件 · copy-md — 把页面正文转成 Markdown 复制走 */
(function () {
  'use strict';
  if (!window.HNP) return;

  function mdTable(table) {
    var rows = Array.prototype.slice.call(table.querySelectorAll('tr'));
    if (!rows.length) return '';
    var lines = rows.map(function (row) {
      return '| ' + Array.prototype.slice.call(row.querySelectorAll('th,td')).map(function (c) {
        return (c.textContent || '').replace(/\s+/g, ' ').trim();
      }).join(' | ') + ' |';
    });
    var cols = rows[0].querySelectorAll('th').length;
    lines.splice(1, 0, '|' + new Array(cols || 1).join(' --- |') + ' --- |');
    return lines.join('\n');
  }

  function toMd(root) {
    var out = [];
    var nodes = root.querySelectorAll('h1,h2,h3,h4,p,li,figcaption,table,pre');
    Array.prototype.forEach.call(nodes, function (n) {
      if (n.closest('[data-hnp-skip]')) return;
      var tag = n.tagName.toLowerCase();
      var text = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;

      if (tag === 'h1') out.push('# ' + text);
      else if (tag === 'h2') out.push('\n## ' + text);
      else if (tag === 'h3') out.push('\n### ' + text);
      else if (tag === 'h4') out.push('\n#### ' + text);
      else if (tag === 'li') out.push('- ' + text);
      else if (tag === 'figcaption') out.push('> ' + text);
      else if (tag === 'table') out.push(mdTable(n));
      else if (tag === 'pre') out.push('```\n' + n.textContent.trim() + '\n```');
      else out.push(text);
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  HNP.define('copy-md', {
    defaults: { source: '#hnp-md-source' },
    mount: function (el, ctx) {
      ctx.on(el, 'click', function () {
        var root = document.querySelector(ctx.opts.source) || document.querySelector('main') || document.body;
        HNP.copy(toMd(root));
        var old = el.textContent;
        el.textContent = '已复制 Markdown';
        setTimeout(function () { el.textContent = old; }, 1700);
        ctx.emit('copy-md:done', { source: ctx.opts.source });
      });
    }
  });
})();
