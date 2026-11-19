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

/* ---------- 清理并重建 src/ ---------- */
await rm(TEMPLATE, { recursive: true, force: true });
await mkdir(join(TEMPLATE, 'src'), { recursive: true });
await mkdir(join(TEMPLATE, 'plugins'), { recursive: true });

await copyFile(join(REPO, 'src', 'hnp.js'), join(TEMPLATE, 'src', 'hnp.js'));
await copyFile(join(REPO, 'src', 'hnp.css'), join(TEMPLATE, 'src', 'hnp.css'));

const pluginFiles = (await readdir(join(REPO, 'plugins'))).filter((f) => f.endsWith('.js')).sort();
for (const f of pluginFiles) {
  await copyFile(join(REPO, 'plugins', f), join(TEMPLATE, 'plugins', f));
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
