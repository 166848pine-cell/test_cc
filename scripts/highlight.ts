// 見せ場だけをつないだハイライト（サンプル）動画を作る。全編を書き出すより速い。
//   node scripts/highlight.ts episodes/001-toshiba
//   node scripts/highlight.ts episodes/001-toshiba --clips=ch0-s1:0-6,ch5-s2:12-24
//     … シーンID:開始秒-終了秒（シーン先頭からの秒）。省略時は各章の最初の図を 7 秒ずつ
// 出力: episodes/<回>/sample.mp4
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {episodeDirFromArgs, ROOT} from './lib.ts';
import type {Timeline} from '../remotion/src/types.ts';

const episodeDir = episodeDirFromArgs();
const timelinePath = path.join(episodeDir, 'timeline.json');
if (!existsSync(timelinePath)) {
  console.error('timeline.json がありません。先に tts.ts と build-timeline.ts を実行してください');
  process.exit(1);
}
const timeline = JSON.parse(readFileSync(timelinePath, 'utf8')) as Timeline;
const fps = timeline.fps;

type Clip = {id: string; from: number; to: number};
const arg = process.argv.find((a) => a.startsWith('--clips='));
let clips: Clip[];
if (arg) {
  clips = arg
    .slice('--clips='.length)
    .split(',')
    .map((c) => {
      const [id, range] = c.split(':');
      const s = timeline.scenes.find((x) => x.id === id);
      if (!s) throw new Error(`シーンが見つかりません: ${id}`);
      const [a, b] = (range ?? `0-${s.durationInFrames / fps}`).split('-').map(Number);
      return {id, from: s.from + Math.round(a * fps), to: Math.min(s.from + s.durationInFrames, s.from + Math.round(b * fps)) - 1};
    });
} else {
  const seen = new Set<string>();
  clips = [];
  for (const s of timeline.scenes) {
    if (s.visual.type === 'title' || seen.has(s.chapterId)) continue;
    seen.add(s.chapterId);
    clips.push({id: s.id, from: s.from, to: Math.min(s.from + s.durationInFrames, s.from + 7 * fps) - 1});
  }
}

const work = path.join(episodeDir, '_sample');
rmSync(work, {recursive: true, force: true});
mkdirSync(work, {recursive: true});
const common = [`--props=${timelinePath}`, `--public-dir=${episodeDir}`, '--log=error', '--codec=h264', '--crf=23', '--audio-codec=aac', '--audio-bitrate=160k'];
if (process.env.REMOTION_BROWSER_EXECUTABLE) common.push(`--browser-executable=${process.env.REMOTION_BROWSER_EXECUTABLE}`);
if (process.env.REMOTION_CONCURRENCY) common.push(`--concurrency=${process.env.REMOTION_CONCURRENCY}`);

const parts: string[] = [];
for (const [i, c] of clips.entries()) {
  const out = path.join(work, `${String(i).padStart(2, '0')}-${c.id}.mp4`);
  console.log(`[${i + 1}/${clips.length}] ${c.id}  ${(c.from / fps).toFixed(1)}〜${((c.to + 1) / fps).toFixed(1)} 秒`);
  const r = spawnSync('npx', ['remotion', 'render', 'Episode', out, `--frames=${c.from}-${c.to}`, ...common], {cwd: path.join(ROOT, 'remotion'), stdio: ['ignore', 'ignore', 'inherit']});
  if (r.status !== 0) process.exit(r.status ?? 1);
  parts.push(out);
}
const list = path.join(work, 'list.txt');
writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n') + '\n');
const sample = path.join(episodeDir, 'sample.mp4');
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', sample], {stdio: 'inherit'});
if (r.status !== 0) process.exit(r.status ?? 1);
rmSync(work, {recursive: true, force: true});
const total = clips.reduce((a, c) => a + (c.to - c.from + 1), 0) / fps;
console.log(`サンプル動画: ${sample}（${clips.length} 場面・約 ${total.toFixed(0)} 秒、音声 ${timeline.audioMode === 'voicevox' ? 'VOICEVOX' : '無音の代用＋効果音'}）`);
