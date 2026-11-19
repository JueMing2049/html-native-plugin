#!/usr/bin/env node
/**
 * sync-template.mjs · 从仓内 src/ 与 plugins/ 生成技能模板，并写入版本戳
 *
 * 为什么要这一步：模板如果靠手工从仓里复制，两边必然漂移。模板现在是**产物**，
 * 不是手抄本——改库就跑一次这个脚本，模板跟着变，版本和 commit 也一起记下来。
 *
 * 用法（在仓库任意位置）：node skill/scripts/sync-template.mjs
 */

import { readFile, writeFile, copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(HERE, '..');
const REPO = resolve(SKILL, '..');
const TEMPLATE = join(SKILL, 'assets', 'template');

const VERSION = (await readFile(join(REPO, 'VERSION'), 'utf8')).trim();

if (!VERSION) {
  console.error('仓库根目录的 VERSION 文件为空');
  process.exit(2);
}

let commit = 'unknown';
try {
  commit = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
} catch {
  console.warn('拿不到 git commit（不在仓库里？），VERSION.json 里记为 unknown');
}

/* ---------- 期望内容 ---------- */
const expected = [
  ['src/hnp.js', join(REPO, 'src', 'hnp.js')],
  ['src/hnp.css', join(REPO, 'src', 'hnp.css')]
];
const pluginFiles = (await readdir(join(REPO, 'plugins'))).filter((f) => f.endsWith('.js')).sort();
for (const f of pluginFiles) {
  expected.push(['plugins/' + f, join(REPO, 'plugins', f)]);
}

/* ---------- 校验模式：只报告，不写盘 ---------- */
// CI 用这个模式。它不能写 VERSION.json，因为那里的 commit 是"生成时的 HEAD"，
// 在 PR 上必然与已提交的不一致——写进去等于每次都制造假差异。
if (process.argv.includes('--check')) {
  const problems = [];

  for (const [rel, from] of expected) {
    const to = join(TEMPLATE, rel);
    if (!existsSync(to)) { problems.push('缺失 ' + rel); continue; }
    const a = await readFile(from);
    const b = await readFile(to);
    if (!a.equals(b)) problems.push('不一致 ' + rel);
  }

  const expectedRels = new Set(expected.map(([rel]) => rel.replace(/\\/g, '/')));
  for (const dir of ['src', 'plugins']) {
    const dirPath = join(TEMPLATE, dir);
    if (!existsSync(dirPath)) continue;
    for (const f of await readdir(dirPath)) {
      const rel = dir + '/' + f;
      if (!expectedRels.has(rel)) problems.push('多余 ' + rel + '（上游已不存在）');
    }
  }

  // 版本号三处必须一致：VERSION 文件、运行时里的常量、模板戳
  const runtimeVersion = (await readFile(join(REPO, 'src', 'hnp.js'), 'utf8'))
    .match(/var VERSION = '([^']+)'/)?.[1];
  if (runtimeVersion !== VERSION) {
    problems.push(`版本不一致：VERSION 是 ${VERSION}，src/hnp.js 里是 ${runtimeVersion}`);
  }
  const stampPath = join(SKILL, 'assets', 'VERSION.json');
  if (!existsSync(stampPath)) {
    problems.push('缺失 assets/VERSION.json');
  } else {
    const stampVersion = JSON.parse(await readFile(stampPath, 'utf8')).version;
    if (stampVersion !== VERSION) {
      problems.push(`版本不一致：assets/VERSION.json 是 ${stampVersion}`);
    }
  }

  if (problems.length) {
    console.error('模板与库不同步，先跑一次 node skill/scripts/sync-template.mjs：');
    problems.forEach((p) => console.error('  - ' + p));
    process.exit(1);
  }
  console.log(`模板与库一致：v${runtimeVersion}，${expected.length} 个文件已核对`);
  process.exit(0);
}

/* ---------- 写入模式：清理并重建 ---------- */
await rm(TEMPLATE, { recursive: true, force: true });
await mkdir(join(TEMPLATE, 'src'), { recursive: true });
await mkdir(join(TEMPLATE, 'plugins'), { recursive: true });

for (const [rel, from] of expected) {
  await copyFile(from, join(TEMPLATE, rel));
}

/* ---------- 版本戳 ---------- */
const stamp = {
  version: VERSION,
  commit,
  repo: 'https://github.com/JueMing2049/html-native-plugin',
  templatePath: 'skill/assets/template',
  plugins: pluginFiles.map((f) => f.replace(/\.js$/, '')),
  syncedAt: new Date().toISOString()
};
await writeFile(join(SKILL, 'assets', 'VERSION.json'), JSON.stringify(stamp, null, 2) + '\n', 'utf8');

console.log(`模板已同步：v${VERSION} (${commit.slice(0, 7)})`);
console.log(`  src/     2 个文件`);
console.log(`  plugins/ ${pluginFiles.length} 个插件`);
