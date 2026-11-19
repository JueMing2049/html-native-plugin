#!/usr/bin/env node
/**
 * upgrade.mjs · 把项目里的 HNP 升到技能自带的新版本，但只动你没改过的文件
 *
 * 判断依据是项目里的 .hnp-lock.json：它记着生成时每个上游文件的哈希。
 *   - 目标文件哈希 == 锁里的哈希  → 你没动过 → 可以安全替换
 *   - 目标文件哈希 != 锁里的哈希  → 你改过     → 跳过并列出，--force 才覆盖
 *   - src/hnp-theme.css 不在升级范围，那是使用者自己的样式层
 *
 * 用法：
 *   node upgrade.mjs --dir <项目目录>            # 只预览，不写盘（默认）
 *   node upgrade.mjs --dir <项目目录> --apply    # 真的替换
 *   node upgrade.mjs --dir <项目目录> --apply --force   # 连你改过的文件也覆盖
 */

import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(HERE, '..', 'assets');
const TEMPLATE = join(ASSETS, 'template');
const LOCK_NAME = '.hnp-lock.json';

function parseArgs(argv) {
  const flags = new Set();
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { opts[key] = next; i++; }
    else flags.add(key);
  }
  return { flags, opts };
}

const { flags, opts } = parseArgs(process.argv.slice(2));

if (!opts.dir) {
  console.error('缺少 --dir <项目目录>');
  process.exit(2);
}

const target = resolve(opts.dir);
const apply = flags.has('apply');
const force = flags.has('force');

const lockPath = join(target, LOCK_NAME);
if (!existsSync(lockPath)) {
  console.error('目标目录没有 ' + LOCK_NAME + '。');
  console.error('这份项目不是 hnp-scaffold 生成的，或者生成它的版本太老（< 0.2.0）。');
  console.error('这种情况没法判断文件是否被你改过，不做猜测性覆盖。');
  process.exit(3);
}

const lock = JSON.parse(await readFile(lockPath, 'utf8'));

let upstream;
try {
  upstream = JSON.parse(await readFile(join(ASSETS, 'VERSION.json'), 'utf8'));
} catch {
  console.error('技能里没有 assets/VERSION.json，模板还没同步。先跑 scripts/sync-template.mjs');
  process.exit(2);
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

console.log(`项目当前版本：v${lock.hnp.version} (${String(lock.hnp.commit).slice(0, 7)})`);
console.log(`技能自带版本：v${upstream.version} (${String(upstream.commit).slice(0, 7)})`);
if (lock.hnp.version === upstream.version && lock.hnp.commit === upstream.commit) {
  console.log('版本一致，仍逐文件核对哈希。');
}
console.log('');

const plan = [];
for (const [rel, knownHash] of Object.entries(lock.files)) {
  const from = join(TEMPLATE, rel);
  const to = join(target, rel);

  if (!existsSync(from)) {
    plan.push({ rel, action: 'gone', note: '上游已移除' });
    continue;
  }
  const nextBuf = await readFile(from);
  const nextHash = sha256(nextBuf);

  if (!existsSync(to)) {
    plan.push({ rel, action: 'add', nextBuf, nextHash });
    continue;
  }
  const localBuf = await readFile(to);
  const localHash = sha256(localBuf);

  if (localHash !== knownHash) {
    plan.push({ rel, action: force ? 'overwrite' : 'conflict', nextBuf, nextHash, localHash });
    continue;
  }
  if (localHash === nextHash) {
    plan.push({ rel, action: 'same' });
    continue;
  }
  plan.push({ rel, action: 'update', nextBuf, nextHash });
}

const order = { update: 0, add: 1, overwrite: 2, conflict: 3, gone: 4, same: 5 };
plan.sort((a, b) => order[a.action] - order[b.action] || a.rel.localeCompare(b.rel));

const LABEL = {
  update: 'UPDATE   ',
  add: 'ADD      ',
  overwrite: 'OVERWRITE',
  conflict: 'SKIP     ',
  gone: 'GONE     ',
  same: 'same     '
};

let changed = 0;
let conflicts = 0;

for (const item of plan) {
  console.log('  ' + LABEL[item.action] + ' ' + item.rel + (item.action === 'conflict' ? '   （你改过，保留）' : ''));
  if (item.action === 'update' || item.action === 'add' || item.action === 'overwrite') {
    if (apply) {
      await copyFile(join(TEMPLATE, item.rel), join(target, item.rel));
      lock.files[item.rel] = item.nextHash;
    }
    changed++;
  }
  if (item.action === 'conflict') conflicts++;
}

console.log('');

if (!apply) {
  console.log(`预览：待更新 ${changed} 个，冲突 ${conflicts} 个。加 --apply 执行。`);
  if (conflicts) console.log('冲突文件不会被动，要覆盖请加 --force（先自行备份）。');
  process.exit(0);
}

lock.hnp = { version: upstream.version, commit: upstream.commit, repo: upstream.repo };
lock.upgradedAt = new Date().toISOString();
await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');

console.log(`已更新 ${changed} 个文件，lockfile 升到 v${upstream.version}。`);
if (conflicts) {
  console.log(`有 ${conflicts} 个文件你改过，未改动。要让上游版本覆盖它们，加 --force 重跑。`);
}
console.log('提示：src/hnp-theme.css 从不参与升级，你的样式不受影响。');
