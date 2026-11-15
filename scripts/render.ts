// timeline.json を Remotion でレンダリングして out.mp4 と out_no_audio.mp4 を作る。
//   node scripts/render.ts episodes/001-toshiba
//   node scripts/render.ts episodes/001-toshiba --stills            … 確認用の静止画だけ（各章 2 枚＋指定シーン）
//   node scripts/render.ts episodes/001-toshiba --stills=ch1-s2,ch3-s1 … 指定シーンの中ほどの静止画
// 環境変数 REMOTION_BROWSER_EXECUTABLE があれば、そのブラウザでレンダリングする（Remotion がブラウザを取得できない環境向け）
import {copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync} from 'node:fs';
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

const stillsArg = process.argv.findLast((a) => a.startsWith('--stills'));
if (stillsArg) {
  // 確認用の静止画
  // --stills=ch1-s2,ch5-s2@last,ch7-s3@2 … シーン ID（@last で最後のセリフ、@N で N 番目のセリフの中ほど）
  const want = stillsArg.includes('=') ? stillsArg.split('=')[1].split(',') : null;
  const picks: {name: string; frame: number}[] = [];
  const pickFrame = (s: (typeof timeline.scenes)[number], which: string | undefined) => {
    const idx = which === 'last' ? s.lines.length - 1 : which !== undefined ? Number(which) : Math.min(1, s.lines.length - 1);
    const line = s.lines[Math.max(0, Math.min(idx, s.lines.length - 1))];
    return s.from + (line ? line.from + Math.floor(line.durationInFrames / 2) : Math.floor(s.durationInFrames * 0.7));
  };
  if (want) {
    for (const w of want) {
      const [id, which] = w.split('@');
      const s = timeline.scenes.find((x) => x.id === id);
      if (!s) {
        console.error(`シーンが見つかりません: ${id}`);
        process.exit(1);
      }
      picks.push({name: w.replace('@', '_'), frame: pickFrame(s, which)});
    }
  } else {
    // 各章の最初のシーンと 2 つ目のシーン
    for (const s of timeline.scenes) {
      const first = timeline.scenes.find((x) => x.chapterId === s.chapterId)!;
      if (s === first || s.id.endsWith('-s2')) picks.push({name: s.id, frame: pickFrame(s, undefined)});
    }
  }
  const outDir = path.join(episodeDir, 'stills');
  const tmp = path.join(outDir, '_frames');
  rmSync(tmp, {recursive: true, force: true});
  mkdirSync(tmp, {recursive: true});
  const frames = [...new Set(picks.map((p) => p.frame))].sort((a, b) => a - b);
  // 1 回のレンダリングで全フレームを書き出す
  run('npx', ['remotion', 'render', 'Episode', tmp, `--frames=${frames.join(',')}`, '--image-format=png', '--sequence', ...common]);
  const files = readdirSync(tmp).filter((f) => f.endsWith('.png'));
  for (const p of picks) {
    const f = files.find((x) => Number(x.match(/(\d+)\.png$/)?.[1]) === p.frame);
    if (f) copyFileSync(path.join(tmp, f), path.join(outDir, `${p.name}.png`));
    else console.warn(`フレーム ${p.frame} の画像が見つかりません`);
  }
  rmSync(tmp, {recursive: true, force: true});
  console.log(`静止画 ${picks.length} 枚: ${outDir}`);
  process.exit(0);
}

const out = path.join(episodeDir, 'out.mp4');
const outNoAudio = path.join(episodeDir, 'out_no_audio.mp4');
const started = Date.now();
run('npx', ['remotion', 'render', 'Episode', out, '--codec=h264', '--crf=20', '--audio-codec=aac', '--audio-bitrate=192k', ...common]);

// 音量をそろえる（YouTube の基準に近い -16 LUFS 前後。映像は再エンコードしない）
const tmpOut = path.join(episodeDir, 'out.tmp.mp4');
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', out, '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmpOut], ROOT);
renameSync(tmpOut, out);

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
