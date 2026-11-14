// 台本検査 → 音声 → タイムライン → 文書 → 書き出し を順に実行する。
//   node scripts/make.ts episodes/001-toshiba            … 全部
//   node scripts/make.ts episodes/001-toshiba --silent   … VOICEVOX なし（無音の代用）で通しを確認
//   node scripts/make.ts episodes/001-toshiba --no-render … 書き出し以外
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {episodeDirFromArgs, hasFlag, ROOT} from './lib.ts';

const ep = path.relative(ROOT, episodeDirFromArgs());
const steps: [string, string[]][] = [
  ['check-script.ts', [ep]],
  ['tts.ts', [ep, ...(hasFlag('silent') ? ['--silent'] : [])]],
  ['build-timeline.ts', [ep]],
  ['make-docs.ts', [ep]],
];
if (!hasFlag('no-render')) steps.push(['render.ts', [ep]]);
for (const [script, args] of steps) {
  console.log(`\n=== ${script} ${args.join(' ')}`);
  const r = spawnSync('node', [path.join(ROOT, 'scripts', script), ...args], {cwd: ROOT, stdio: 'inherit'});
  if (r.status !== 0) {
    console.error(`${script} で止まりました（exit ${r.status}）`);
    process.exit(r.status ?? 1);
  }
}
