// timeline.json を Remotion でレンダリングして out.mp4 と out_no_audio.mp4 を作る。
//   node scripts/render.ts episodes/001-toshiba
//   node scripts/render.ts episodes/001-toshiba --stills            … 確認用の静止画だけ（各章 2 枚＋指定シーン）
//   node scripts/render.ts episodes/001-toshiba --stills=ch1-s2,ch3-s1 … 指定シーンの中ほどの静止画
// 環境変数 REMOTION_BROWSER_EXECUTABLE があれば、そのブラウザでレンダリングする（Remotion がブラウザを取得できない環境向け）
import {existsSync, mkdirSync, readFileSync, rmSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {episodeDirFromArgs, ROOT} from './lib.ts';
import type {Timeline} from '../remotion/src/types.ts';

const episodeDir = episodeDirFromArgs();
const timelinePath = path.join(episodeDir, 'timeline.json');
if (!existsSync(timelinePath)) {
  console.error('timeline.json がありません。先に build-timeline.ts を実行してください');
  process.exit(1);
}
const timeline = JSON.parse(readFileSync(timelinePath, 'utf8')) as Timeline;
const remotionDir = path.join(ROOT, 'remotion');

const common = [`--props=${timelinePath}`, `--public-dir=${episodeDir}`, '--log=warn'];
if (process.env.REMOTION_BROWSER_EXECUTABLE) common.push(`--browser-executable=${process.env.REMOTION_BROWSER_EXECUTABLE}`);
if (process.env.REMOTION_LICENSE_KEY) common.push(`--license-key=${process.env.REMOTION_LICENSE_KEY}`);

function run(cmd: string, args: string[], cwd = remotionDir) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {cwd, stdio: 'inherit'});
  if (r.status !== 0) {
    console.error(`失敗: ${cmd} (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

function probeDuration(file: string, stream: 'v:0' | 'a:0'): number {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', stream, '-show_entries', 'stream=duration', '-of', 'csv=p=0', file], {encoding: 'utf8'});
  return Number(r.stdout.trim());
}

const stillsArg = process.argv.find((a) => a.startsWith('--stills'));
if (stillsArg) {
  // 確認用の静止画
  const want = stillsArg.includes('=') ? stillsArg.split('=')[1].split(',') : null;
  const picks: {name: string; frame: number}[] = [];
  for (const s of timeline.scenes) {
    const first = timeline.scenes.find((x) => x.chapterId === s.chapterId)!;
    const isPick = want ? want.includes(s.id) : s === first || s.id.endsWith('-s2');
    if (!isPick) continue;
    // 2 つ目のセリフの中ほど（アニメーションが進んだ状態）
    const line = s.lines[Math.min(1, s.lines.length - 1)];
    const local = line ? line.from + Math.floor(line.durationInFrames / 2) : Math.floor(s.durationInFrames * 0.7);
    picks.push({name: s.id, frame: s.from + local});
  }
  const outDir = path.join(episodeDir, 'stills');
  mkdirSync(outDir, {recursive: true});
  for (const p of picks) {
    run('npx', ['remotion', 'still', 'Episode', path.join(outDir, `${p.name}.png`), `--frame=${p.frame}`, ...common]);
  }
  console.log(`静止画 ${picks.length} 枚: ${outDir}`);
  process.exit(0);
}

const out = path.join(episodeDir, 'out.mp4');
const outNoAudio = path.join(episodeDir, 'out_no_audio.mp4');
const started = Date.now();
run('npx', ['remotion', 'render', 'Episode', out, '--codec=h264', '--crf=20', '--audio-codec=aac', '--audio-bitrate=192k', ...common]);

// 映像のみ版（再エンコードせず音声トラックだけ外す）
if (existsSync(outNoAudio)) rmSync(outNoAudio);
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', out, '-map', '0:v:0', '-c:v', 'copy', '-an', outNoAudio], ROOT);

// 尺の確認
const expected = timeline.durationInFrames / timeline.fps;
const v = probeDuration(out, 'v:0');
const a = probeDuration(out, 'a:0');
const n = timeline.narration?.durationSec ?? NaN;
const v2 = probeDuration(outNoAudio, 'v:0');
console.log(
  [
    `レンダリング完了（${((Date.now() - started) / 60000).toFixed(1)} 分）`,
    `  timeline 想定 : ${expected.toFixed(3)} 秒`,
    `  out.mp4 映像  : ${v.toFixed(3)} 秒 / 音声 ${a.toFixed(3)} 秒`,
    `  narration.wav : ${n.toFixed(3)} 秒`,
    `  out_no_audio  : ${v2.toFixed(3)} 秒`,
  ].join('\n'),
);
const tol = 1 / timeline.fps + 0.05;
if (Math.abs(v - expected) > tol || Math.abs(a - v) > 0.1 || Math.abs(n - expected) > tol) {
  console.error('警告: 尺が一致していません');
  process.exit(3);
}
if (timeline.audioMode === 'silent') console.warn('注意: 音声は無音の代用です（VOICEVOX で作り直してください）');
