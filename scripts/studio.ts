// Remotion Studio でエピソードをプレビューする。
//   node scripts/studio.ts episodes/001-toshiba
// 事前に tts.ts と build-timeline.ts で timeline.json を作っておくこと。
import {existsSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {episodeDirFromArgs, ROOT} from './lib.ts';

const episodeDir = episodeDirFromArgs();
const timeline = path.join(episodeDir, 'timeline.json');
if (!existsSync(timeline)) {
  console.error('timeline.json がありません。先に tts.ts と build-timeline.ts を実行してください');
  process.exit(1);
}
const args = ['remotion', 'studio', `--props=${timeline}`, `--public-dir=${episodeDir}`];
if (process.argv.includes('--no-open')) args.push('--no-open');
spawnSync('npx', args, {cwd: path.join(ROOT, 'remotion'), stdio: 'inherit'});
