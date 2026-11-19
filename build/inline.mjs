#!/usr/bin/env node
/**
 * HNP 构建脚本 · 把 hnp.css 与各插件内联进 demo/index.html，产出可离线的单文件 demo/single.html
 * 用法：node build/inline.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC_PAGE = join(ROOT, 'demo', 'index.html');
const OUT_PAGE = join(ROOT, 'demo', 'single.html');

let html = readFileSync(SRC_PAGE, 'utf8');
let cssCount = 0;
let jsCount = 0;

html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g, (whole, href) => {
  const css = readFileSync(resolve(ROOT, 'demo', href), 'utf8');
  if (css.includes('</style>')) throw new Error(`${href} 含 </style>，无法安全内联`);
  cssCount++;
  return `<style>\n${css}\n</style>`;
});

html = html.replace(/<script\s+src="([^"]+)"\s*><\/script>/g, (whole, src) => {
  const js = readFileSync(resolve(ROOT, 'demo', src), 'utf8');
  if (js.includes('</script>')) throw new Error(`${src} 含 </script>，无法安全内联`);
  jsCount++;
  return `<script>\n${js}\n</script>`;
});

const leftover = html.match(/<[a-z][a-z0-9-]*\b[^>]*\s(?:src|href)="(?!https?:|#|mailto:|data:)[^"]*"/gi) || [];
if (leftover.length) {
  console.warn('!! 仍有外部引用未内联：');
  leftover.forEach((item) => console.warn('   ' + item));
}

writeFileSync(OUT_PAGE, html, 'utf8');
console.log(`内联完成：css ${cssCount} 份 / js ${jsCount} 份 -> demo/single.html (${html.length} 字节)`);
