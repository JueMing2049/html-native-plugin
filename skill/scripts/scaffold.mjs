#!/usr/bin/env node
/**
 * hnp-scaffold · 把 HNP 交互层落进一个项目
 *
 * 用法：
 *   node scaffold.mjs --dir <目标目录> [选项]
 *
 * 选项：
 *   --dir <path>          目标项目目录（必需；不存在会自动创建）
 *   --plugins a,b,c       要落地的插件，逗号分隔；默认全部 12 个
 *   --title <str>         演示页标题，默认「HNP 演示」
 *   --no-demo             不生成 demo/，只放运行库与插件
 *   --single              额外产出 demo/single.html（全内联、可离线双击）
 *   --git                 初始化仓库并做首次提交（已在 Git 仓库内则跳过 init）
 *   --force               目标已存在 src/hnp.js 时仍然覆盖（默认拒绝，保护既有项目）
 *   --publish             建公开 GitHub 仓库并推送、可选开 Pages（需配套 publish.ps1）
 *   --repo-name <name>    仓库名，默认取目标目录名
 *   --repo-desc <str>     仓库描述
 *   --no-pages            --publish 时不启用 GitHub Pages
 *   --private             --publish 时建私有仓库（默认公开）
 */

import { mkdir, readFile, writeFile, copyFile, readdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(HERE, '..', 'assets');
const TEMPLATE = join(ASSETS, 'template');
const TEMPLATES = resolve(HERE, '..', 'templates'); // 手写模板：每个目录一个 template.json

// 模板的版本戳由 scripts/sync-template.mjs 写入。缺了不阻断生成，但 lockfile 会记成 unknown，
// 免得以后排查"用户跑的是哪一版"时误以为是最新。
let upstream = { version: '0.0.0', commit: 'unknown', repo: 'https://github.com/JueMing2049/html-native-plugin' };
try {
  upstream = JSON.parse(await readFile(join(ASSETS, 'VERSION.json'), 'utf8'));
} catch {
  console.warn('assets/VERSION.json 缺失，建议先跑一次 scripts/sync-template.mjs');
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

const ALL_PLUGINS = [
  'theme', 'tone', 'toc', 'tabs', 'filter', 'reveal',
  'compare', 'decision', 'anno', 'scrolly', 'timeline', 'copy-md'
];

/* ---------------- 参数 ---------------- */

function parseArgs(argv) {
  const out = { flags: new Set(), opts: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out.opts[key] = next; i++; }
    else out.flags.add(key);
  }
  return out;
}

const { flags, opts } = parseArgs(process.argv.slice(2));

if (flags.has('list-templates')) {
  console.log('basic（默认，通用演示页）');
  if (existsSync(TEMPLATES)) {
    const dirs = (await readdir(TEMPLATES, { withFileTypes: true }))
      .filter((d) => d.isDirectory()).map((d) => d.name).sort();
    dirs.forEach((n) => console.log(n));
  }
  process.exit(0);
}

if (!opts.dir) {
  console.error('缺少 --dir <目标目录>');
  process.exit(2);
}

const target = resolve(opts.dir);
const title = opts.title || 'HNP 演示';
let wantDemo = !flags.has('no-demo');
const wantSingle = flags.has('single');
const wantGit = flags.has('git');
const wantPublish = flags.has('publish');
const force = flags.has('force');

/* ---------------- 模板 ---------------- */

const templateName = opts.template || 'basic';
let templateMeta = null;

if (templateName !== 'basic') {
  const metaPath = join(TEMPLATES, templateName, 'template.json');
  if (!existsSync(metaPath)) {
    console.error('找不到模板：' + templateName);
    const available = existsSync(TEMPLATES) ? (await readdir(TEMPLATES)).join(', ') : '（无）';
    console.error('可选：basic, ' + available);
    process.exit(2);
  }
  templateMeta = JSON.parse(await readFile(metaPath, 'utf8'));
  // 模板自带完整页面，就不再生成通用演示页
  wantDemo = false;
}

const wanted = opts.plugins
  ? opts.plugins.split(',')
  : (templateMeta && templateMeta.plugins ? templateMeta.plugins : ALL_PLUGINS);

const plugins = wanted.map((s) => s.trim()).filter(Boolean);

const unknown = plugins.filter((p) => !ALL_PLUGINS.includes(p));
if (unknown.length) {
  console.error('未知插件：' + unknown.join(', '));
  console.error('可选：' + ALL_PLUGINS.join(', '));
  process.exit(2);
}
if (!plugins.length) {
  console.error('至少要留一个插件');
  process.exit(2);
}

/* ---------------- 保护既有项目 ---------------- */

const hnpTarget = join(target, 'src', 'hnp.js');
if (existsSync(hnpTarget) && !force) {
  console.error('目标已存在 src/hnp.js，未做任何改动。确认要覆盖请加 --force');
  process.exit(3);
}

/* ---------------- 落文件 ---------------- */

await mkdir(join(target, 'src'), { recursive: true });
await mkdir(join(target, 'plugins'), { recursive: true });

await copyFile(join(TEMPLATE, 'src', 'hnp.js'), join(target, 'src', 'hnp.js'));
await copyFile(join(TEMPLATE, 'src', 'hnp.css'), join(target, 'src', 'hnp.css'));

for (const name of plugins) {
  await copyFile(join(TEMPLATE, 'plugins', name + '.js'), join(target, 'plugins', name + '.js'));
}

// 用户样式层：只在不存在时创建。已存在说明使用者改过，重跑脚手架不能动它。
const themePath = join(target, 'src', 'hnp-theme.css');
const themeCreated = !existsSync(themePath);
if (themeCreated) await copyFile(join(ASSETS, 'theme.css'), themePath);

// 模板自带的文件（页面、脚本、图源、图标）。template.json 是给脚手架读的，不进目标项目。
if (templateMeta) {
  const src = join(TEMPLATES, templateName);
  for (const entry of await readdir(src)) {
    if (entry === 'template.json') continue;
    await cp(join(src, entry), join(target, entry), { recursive: true });
  }
}

/* ---------------- 每个插件的演示块 ---------------- */

const SECTIONS = {
  tabs: () => `
      <section id="s-tabs">
        <h2>标签页 tabs</h2>
        <div class="hnp-tabs" data-hnp="tabs">
          <div class="hnp-tabs__bar">
            <button class="hnp-tab" type="button">第一页</button>
            <button class="hnp-tab" type="button">第二页</button>
          </div>
          <div class="hnp-pane"><p>容器上写 <code>data-hnp="tabs"</code>，里面的 <code>.hnp-tab</code> 与 <code>.hnp-pane</code> 按下标自动配对。</p></div>
          <div class="hnp-pane"><p>支持左右方向键切换，同一元素重复挂载不会重复绑定。</p></div>
        </div>
      </section>`,

  filter: () => `
      <section id="s-filter">
        <h2>筛选 filter</h2>
        <div data-hnp-scope>
          <div data-hnp="filter">
            <div class="hnp-chips">
              <button class="hnp-chip on" type="button" data-k="all">全部</button>
              <button class="hnp-chip" type="button" data-k="a">甲类</button>
              <button class="hnp-chip" type="button" data-k="b">乙类</button>
            </div>
            <div class="item" data-hnp-tags="a">甲类条目</div>
            <div class="item" data-hnp-tags="b">乙类条目</div>
            <div class="item" data-hnp-tags="a b">甲乙都算</div>
          </div>
        </div>
      </section>`,

  compare: () => `
      <section id="s-compare">
        <h2>对比滑块 compare</h2>
        <div class="hnp-cmp" data-hnp="compare">
          <div class="hnp-cmp__a"><h3>改之前</h3><p>每个页面重写一遍事件绑定。</p></div>
          <div class="hnp-cmp__b"><h3>改之后</h3><p>声明式挂载，可挂可卸。</p></div>
          <div class="hnp-cmp__h" title="拖动对比"></div>
        </div>
      </section>`,

  decision: () => `
      <section id="s-decision">
        <h2>决策卡 decision</h2>
        <div class="hnp-dcard" data-hnp="decision" data-id="D-1" data-title="示例决策">
          <div class="hnp-dcard__q">这一项要不要现在定？</div>
          <div class="hnp-dopts">
            <button class="hnp-dopt" type="button" data-key="yes">现在定</button>
            <button class="hnp-dopt" type="button" data-key="later">放到下一轮</button>
          </div>
          <div class="hnp-dcard__f">
            <button class="hnp-btn pri" type="button" data-act="confirm">记下这个决定</button>
            <span class="hnp-dcard__out"></span>
          </div>
        </div>
      </section>`,

  reveal: () => `
      <section id="s-reveal" data-hnp="reveal">
        <h2>渐入与数字 reveal</h2>
        <div class="grid2">
          <div class="hnp-reveal"><div class="kpi"><span data-hnp-count="12">0</span><small>可用插件</small></div></div>
          <div class="hnp-reveal"><div class="kpi"><span data-hnp-count="0" data-hnp-dec="1">0</span><small>运行时依赖</small></div></div>
        </div>
        <div class="hnp-reveal" style="margin-top:16px">
          <p class="muted" style="margin-bottom:6px">条形生长</p>
          <div class="hnp-bar" data-hnp-w="86%"></div>
        </div>
      </section>`,

  scrolly: () => `
      <section id="s-scrolly">
        <h2>滚动叙事 scrolly</h2>
        <div class="hnp-scrolly" data-hnp="scrolly">
          <div>
            <div class="hnp-step"><h4>一 · 写结构</h4><p>先把正文写完整，没有 JS 也能读。</p></div>
            <div class="hnp-step"><h4>二 · 挂插件</h4><p>在容器上写 <code>data-hnp</code>。</p></div>
          </div>
          <div class="hnp-scrolly__g">
            <div data-hnp-fig="1"><h3>结构</h3><p class="muted">此时没有任何脚本。</p></div>
            <div data-hnp-fig="2"><h3>交互</h3><p class="muted">滚动位置决定显示哪一帧。</p></div>
          </div>
        </div>
      </section>`,

  timeline: () => `
      <section id="s-timeline">
        <h2>时间轴 timeline</h2>
        <div class="hnp-tl" data-hnp="timeline">
          <div class="hnp-tl__i"><div class="hnp-tl__d">STEP 01</div><div class="hnp-tl__t">先有内容</div><p class="hnp-tl__p">静态 HTML 先站住。</p></div>
          <div class="hnp-tl__i"><div class="hnp-tl__d">STEP 02</div><div class="hnp-tl__t">再挂交互</div><p class="hnp-tl__p">逐项点亮，随滚动进入视口。</p></div>
        </div>
      </section>`,

  anno: () => `
      <section id="s-anno">
        <h2>就地批注 anno</h2>
        <p class="muted">选中下面这块里的任意一句，会浮出「＋ 批注」。</p>
        <div class="card" data-block="demo-1" style="position:relative">
          <h3>可被批注的块</h3>
          <p class="muted">这一整块带 <code>data-block</code>，块内任意句子都能被选中批注；批注会记下块名、原文、类型与时间。</p>
        </div>
      </section>`,

  toc: () => ''
};

const SECTION_ORDER = ['tabs', 'filter', 'compare', 'decision', 'reveal', 'scrolly', 'timeline', 'anno'];

/* ---------------- 生成 demo ---------------- */

const barButtons = [];
if (plugins.includes('tone')) barButtons.push('<button class="hnp-btn" type="button" data-hnp="tone">通俗版</button>');
if (plugins.includes('theme')) barButtons.push('<button class="hnp-btn" type="button" data-hnp="theme">浅色</button>');
if (plugins.includes('copy-md')) barButtons.push('<button class="hnp-btn" type="button" data-hnp="copy-md">复制 Markdown</button>');

const bodySections = SECTION_ORDER.filter((n) => plugins.includes(n)).map((n) => SECTIONS[n]()).join('\n');

const tocLinks = plugins.includes('toc')
  ? SECTION_ORDER
      .filter((n) => plugins.includes(n) && n !== 'anno')
      .map((n) => `        <a href="#s-${n}">${n}</a>`)
      .join('\n')
  : '';

const scriptTags = ['  <script src="../src/hnp.js"></script>']
  .concat(plugins.map((p) => `  <script src="../plugins/${p}.js"></script>`))
  .join('\n');

const demoHtml = `<!doctype html>
<html lang="zh-CN" data-theme="dark" data-tone="pro">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="../src/hnp.css" />
<link rel="stylesheet" href="../src/hnp-theme.css" />
<style>
  *{box-sizing:border-box}
  html{scroll-behavior:smooth;scroll-padding-top:78px}
  body{margin:0;color:var(--txt);background:var(--bg);font-family:var(--sans);font-size:16px;line-height:1.78}
  .wrap{max-width:1020px;margin:0 auto;padding:0 26px}
  .bar{position:sticky;top:0;z-index:60;backdrop-filter:blur(14px);background:rgba(11,9,16,.82);border-bottom:1px solid var(--line)}
  [data-theme="light"] .bar{background:rgba(247,244,239,.86)}
  .bar__in{max-width:1020px;margin:0 auto;padding:10px 26px;display:flex;align-items:center;gap:10px}
  .brand{font-family:var(--mono);font-size:12px;letter-spacing:.14em;color:var(--txt3)}
  .brand b{color:var(--jade);font-weight:500}
  .bar__sp{flex:1}
  .layout{display:grid;grid-template-columns:170px minmax(0,1fr);gap:40px;padding:30px 0 90px;align-items:start}
  h1{font-family:var(--serif);font-size:clamp(26px,3.6vw,36px);line-height:1.28;margin:0 0 12px;font-weight:600}
  h1 em{font-style:normal;color:var(--jade)}
  h2{font-family:var(--mono);font-size:11.5px;letter-spacing:.16em;color:var(--txt3);text-transform:uppercase;margin:0 0 14px;font-weight:400;display:flex;align-items:center;gap:12px}
  h2::after{content:"";flex:1;height:1px;background:var(--line)}
  h3{font-family:var(--serif);font-size:16px;margin:0 0 8px;font-weight:600}
  section{padding-top:38px}
  p{margin:0 0 10px}
  .muted{color:var(--txt2);font-size:14px}
  .lead{color:var(--txt2);max-width:620px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px 22px}
  .grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
  .kpi{font-family:var(--mono);font-size:28px;color:var(--jade);line-height:1.2}
  .kpi small{display:block;font-family:var(--sans);font-size:12.5px;color:var(--txt3);margin-top:4px}
  .item{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-bottom:8px;font-size:14px;color:var(--txt2)}
  @media (max-width:820px){.layout{grid-template-columns:1fr}.hnp-toc{display:none}}
</style>
</head>
<body${plugins.includes('anno') ? ' data-hnp="anno"' : ''}>

<div class="bar">
  <div class="bar__in">
    <span class="brand">HNP <b>v${upstream.version}</b></span>
    <span class="bar__sp"></span>
    ${barButtons.join('\n    ')}
  </div>
</div>

<div class="wrap">
  <header style="padding:48px 0 4px">
    <h1>页面本来就会动，<em>只是没人告诉它</em></h1>
    <p class="lead">这里只落了你要的那几个插件：<code>${plugins.join('</code> <code>')}</code>。删掉不需要的 section，剩下的就是最小可运行样本。</p>
  </header>

  <div class="layout">
${tocLinks ? `    <nav class="hnp-toc" data-hnp="toc">\n${tocLinks}\n    </nav>\n` : ''}    <main id="hnp-md-source">
${bodySections}
    </main>
  </div>
</div>

${scriptTags}
</body>
</html>
`;

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------------- README ---------------- */

const PLUGIN_DOC = {
  theme: ['深/浅色切换', '按钮'],
  tone: ['专业/通俗双版表达切换', '按钮'],
  toc: ['目录跟随当前滚动位置', '含锚点链接的容器'],
  tabs: ['标签页，支持方向键', '.hnp-tabs 容器'],
  filter: ['按标签筛选', '筛选条容器'],
  reveal: ['渐入、数字滚动、条形生长', '区块容器'],
  compare: ['前后对比滑块', '.hnp-cmp 容器'],
  decision: ['决策卡：单选 + 备注 + 落库', '.hnp-dcard 容器'],
  anno: ['就地批注，导出台账 JSON', 'body'],
  scrolly: ['滚动叙事', '.hnp-scrolly 容器'],
  timeline: ['时间轴逐项点亮', '.hnp-tl 容器'],
  'copy-md': ['正文转 Markdown 复制', '按钮']
};

const readme = `# ${basename(target)}

已接入 [HNP](https://github.com/JueMing2049/html-native-plugin) 零依赖 HTML 原生交互层，生成版本 \`v${upstream.version}\`。
${templateMeta ? `\n模板：**${templateMeta.title}**（\`${templateMeta.name}\`）。入口 \`${templateMeta.entry || 'index.html'}\`。\n` : ''}

## 已落地的文件

\`\`\`
src/hnp.js          运行时（上游 · 勿改）
src/hnp.css         设计 token 与组件样式（上游 · 勿改）
src/hnp-theme.css   你的样式层（随便改，升级不覆盖）
plugins/            ${plugins.length} 个插件（上游 · 勿改）
.hnp-lock.json      来源记录（版本、上游 commit、每文件哈希）
${wantDemo ? 'demo/index.html    最小可运行示例\n' : ''}\`\`\`

改配色、间距、字体请写 \`src/hnp-theme.css\`。改了上游文件也能跑，但升级时会被识别为"你改过"，跳过并提示。

## 已启用的插件

| \`data-hnp\` | 作用 | 挂在哪 |
| --- | --- | --- |
${plugins.map((p) => `| \`${p}\` | ${PLUGIN_DOC[p][0]} | ${PLUGIN_DOC[p][1]} |`).join('\n')}

## 接进自己的页面

在页面头部引样式，在 \`</body>\` 前引运行时与插件，顺序不能反（插件靠 \`HNP.define\` 注册，运行时必须先到）：

\`\`\`html
<link rel="stylesheet" href="src/hnp.css" />
<link rel="stylesheet" href="src/hnp-theme.css" />
...
<script src="src/hnp.js"></script>
${plugins.map((p) => `<script src="plugins/${p}.js"></script>`).join('\n')}
\`\`\`

\`src/hnp.css\` 是上游文件，升级会整份替换，**别改**。要改配色、间距、字体，写进 \`src/hnp-theme.css\`，那是你的地盘，升级永远不碰。

然后在需要交互的容器上写 \`data-hnp\`，一个容器可以挂多个，用空格分隔：

\`\`\`html
<div data-hnp="${plugins.slice(0, 2).join(' ')}">…</div>
\`\`\`

运行时会在 \`DOMContentLoaded\` 时自动挂载一次，无需手写调用。

## 几条容易踩的线

- **批注需要 \`data-block\`**：\`anno\` 只认带 \`data-block\` 的容器，块内文本才能被选中批注。
- **筛选要有作用域**：把 \`filter\` 的容器和条目一起放进 \`data-hnp-scope\`，多份筛选才不会互相清空。
- **中间不要插队**：\`hnp.js\` 必须排在所有 \`plugins/*.js\` 之前。
- **单文件分发**：需要离线或邮件发送时，用 \`--single\` 生成全内联的 \`demo/single.html\`。

## 卸载与重挂

\`\`\`js
HNP.unmount(document, 'tabs');   // 卸载并按登记清理所有监听器
HNP.use('tabs').mount(document); // 重新挂载
HNP.inspect();                   // 查看当前各插件实例数
\`\`\`

## 以后升级

上游发了新版，不必重新生成（那会冲掉你的改动）。用升级命令，它靠 \`.hnp-lock.json\` 判断哪些文件你没动过：

\`\`\`bash
# 先看会动哪些文件（默认只预览，不写盘）
node <skill>/scripts/upgrade.mjs --dir .

# 确认后执行
node <skill>/scripts/upgrade.mjs --dir . --apply
\`\`\`

你没动过的上游文件会被替换；你动过的会列出来并跳过；\`src/hnp-theme.css\` 永远不在升级范围内。

## 看效果

${templateMeta
  ? `打开 \`${templateMeta.entry || 'index.html'}\`：先定级、再对标、再画图，五图确认后誊字段，最后导出 \`diagram-first.json\` 与 \`app-spec.md\`。`
  : (wantDemo ? '双击 `demo/index.html`' + (wantSingle ? '，或 `demo/single.html`（全内联、可离线）' : '') + '。' : '本项目只放了运行库与插件，没有生成 demo。')}
`;

/* ---------------- 写出 ---------------- */

if (wantDemo) {
  await mkdir(join(target, 'demo'), { recursive: true });
  await writeFile(join(target, 'demo', 'index.html'), demoHtml, 'utf8');

  if (wantSingle) {
    let html = await readFile(join(target, 'demo', 'index.html'), 'utf8');
    html = await inlineAssets(html, join(target, 'demo'));
    await writeFile(join(target, 'demo', 'single.html'), html, 'utf8');
  }
}

await writeFile(join(target, 'README.md'), readme, 'utf8');

// 模板页的单文件版：图源也一起内联，断网、打印、发邮件都能用
if (templateMeta && wantSingle) {
  const entry = templateMeta.entry || 'index.html';
  let html = await readFile(join(target, entry), 'utf8');
  html = await inlineAssets(html, target);
  await writeFile(join(target, 'single.html'), html, 'utf8');
}

/* ---------------- 来源记录 ----------------
 * lockfile 是"升级"能不能安全进行的前提：记下生成时每个上游文件的哈希，
 * 以后就能分清"用户没动过（可安全替换）"和"用户改过（必须问一句）"。
 * hnp-theme.css 不记进来——那是使用者的地盘，本来就不归上游管。
 */
const trackedFiles = ['src/hnp.js', 'src/hnp.css'].concat(plugins.map((p) => 'plugins/' + p + '.js'));
const files = {};
for (const rel of trackedFiles) {
  files[rel] = sha256(await readFile(join(target, rel)));
}

const lock = {
  tool: 'hnp-scaffold',
  generatedAt: new Date().toISOString(),
  hnp: {
    version: upstream.version,
    commit: upstream.commit,
    repo: upstream.repo
  },
  // 模板页、scripts/、figures/ 都是使用者要改的东西，不进 files，升级不会碰
  template: templateMeta ? { name: templateName, version: upstream.version } : { name: 'basic' },
  plugins,
  theme: 'src/hnp-theme.css',
  files
};
await writeFile(join(target, '.hnp-lock.json'), JSON.stringify(lock, null, 2) + '\n', 'utf8');

async function inlineAssets(html, baseDir) {
  const marks = [];
  for (const [source, open, close, guard] of [
    ['<link\\s+rel="stylesheet"\\s+href="([^"]+)"\\s*\\/?>', '<style>', '</style>', '</style>'],
    ['<script\\s+src="([^"]+)"\\s*><\\/script>', '<script>', '</script>', '</script>'],
    // 单文件产物要能离线打开，图源也得内联进来；图源文件本身仍然保留，可 diff
    ['<img\\s+[^>]*src="([^"]+\\.svg)"[^>]*>', '', '', null]
  ]) {
    const re = new RegExp(source, 'g');
    let mm;
    while ((mm = re.exec(html))) {
      marks.push({ start: mm.index, end: mm.index + mm[0].length, href: mm[1], open, close, guard });
    }
  }
  // 从后往前替换，避免前面的替换把后面的位置推错
  marks.sort((a, b) => b.start - a.start);

  let out = html;
  for (const mk of marks) {
    const content = await readFile(resolve(baseDir, mk.href), 'utf8');
    if (mk.guard && content.includes(mk.guard)) {
      throw new Error(mk.href + ' 含 ' + mk.guard + '，无法安全内联');
    }
    out = out.slice(0, mk.start) + mk.open + '\n' + content + '\n' + mk.close + out.slice(mk.end);
  }
  return out;
}

/* ---------------- Git ---------------- */

let gitInfo = null;
if (wantGit) {
  gitInfo = ensureGit(target);
}

function ensureGit(dir) {
  let inRepo = false;
  try {
    // stderr 丢弃：这一步本来就是"探测是否已在仓库里"，失败是正常分支，不该吓到使用者
    const top = execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    inRepo = true;
    return { inited: false, toplevel: top, committed: false };
  } catch {
    inRepo = false;
  }
  execFileSync('git', ['-C', dir, 'init'], { stdio: 'pipe' });
  execFileSync('git', ['-C', dir, 'branch', '-M', 'main'], { stdio: 'pipe' });

  const paths = ['src', 'plugins', 'README.md']
    .concat(wantDemo ? ['demo'] : [])
    .concat(templateMeta ? ['index.html', 'scripts', 'figures', 'assets'] : []);
  execFileSync('git', ['-C', dir, 'add'].concat(paths), { stdio: 'pipe' });
  execFileSync('git', ['-C', dir, 'commit', '-m', 'feat: 接入 HNP HTML 原生交互层'], { stdio: 'pipe' });
  return { inited: true, toplevel: dir, committed: true };
}

/* ---------------- 发布 ---------------- */

let publishInfo = null;
if (wantPublish) {
  const repoName = opts['repo-name'] || basename(target);
  const payload = {
    dir: target,
    name: repoName,
    description: opts['repo-desc'] || '零依赖 HTML 原生交互层（HNP）',
    private: flags.has('private'),
    pages: !flags.has('no-pages')
  };
  const payloadPath = join(tmpdir(), 'hnp-publish-' + Date.now() + '.json');
  await writeFile(payloadPath, JSON.stringify(payload, null, 2), 'utf8');

  const ps = resolve(HERE, 'publish.ps1');
  const run = spawnSync('powershell', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps, '-Payload', payloadPath
  ], { encoding: 'utf8' });

  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);
  publishInfo = { exitCode: run.status, payloadPath };
}

/* ---------------- 汇总 ---------------- */

console.log(JSON.stringify({
  target,
  template: templateName,
  hnp: { version: upstream.version, commit: upstream.commit },
  plugins,
  theme: { path: 'src/hnp-theme.css', created: themeCreated },
  lock: '.hnp-lock.json',
  demo: wantDemo,
  single: wantSingle,
  git: gitInfo,
  publish: publishInfo
}, null, 2));

if (publishInfo && publishInfo.exitCode !== 0) process.exit(publishInfo.exitCode || 1);
