// ずんだもん・四国めたんの公式イラスト（東北ずん子・ずんだもんプロジェクトの素材ページ）を取得して、
// 立ち絵用に縮小して assets/characters/ に置く。画像は再配布にあたるので Git には入れない。
//   node scripts/fetch-characters.ts
// 利用条件：https://zunko.jp/guideline.html（キャラクター利用の手引き）を守ること。
import {existsSync, mkdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT} from './lib.ts';

export const CHARACTER_SOURCES = {
  zundamon: {url: 'https://zunko.jp/sozai/zundamon/zunmon002.png', page: 'https://zunko.jp/con_illust.html'},
  metan: {url: 'https://zunko.jp/sozai/zunkohoka/metan_006.png', page: 'https://zunko.jp/con_illust.html'},
} as const;

const outDir = path.join(ROOT, 'assets', 'characters');
mkdirSync(outDir, {recursive: true});
for (const [name, src] of Object.entries(CHARACTER_SOURCES)) {
  const out = path.join(outDir, `${name}.png`);
  if (existsSync(out) && !process.argv.includes('--force')) {
    console.log(`あり: ${out}`);
    continue;
  }
  const raw = path.join(outDir, `${name}.orig.png`);
  const dl = spawnSync('curl', ['-sS', '-f', '-m', '120', '-o', raw, src.url], {stdio: 'inherit'});
  if (dl.status !== 0) {
    console.error(`取得できません: ${src.url}（ネットワーク設定で zunko.jp を許可してください）`);
    process.exit(1);
  }
  // 高さ 1400px に縮小（描画を軽くするため）
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-vf', 'scale=-1:1400:flags=lanczos', out], {stdio: 'inherit'});
  rmSync(raw, {force: true});
  if (r.status !== 0) process.exit(1);
  console.log(`取得: ${name} ← ${src.url}`);
}
