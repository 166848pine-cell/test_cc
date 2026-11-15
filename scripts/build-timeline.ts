// audio/manifest.json（各セリフの長さ）から timeline.json と audio/narration.wav を作る。
//   node scripts/build-timeline.ts episodes/001-toshiba
import {copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {episodeDirFromArgs, loadScript, lineId, readWav, writeWav, writeJson, ROOT} from './lib.ts';
import type {Timeline, TimelineScene, TimelineLine} from '../remotion/src/types.ts';

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const SCENE_HEAD_SEC = 0.3;

const episodeDir = episodeDirFromArgs();
const script = loadScript(episodeDir);
const manifestPath = path.join(episodeDir, 'audio', 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('audio/manifest.json がありません。先に node scripts/tts.ts を実行してください');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  mode: 'voicevox' | 'silent';
  lines: Record<string, {durationSec: number}>;
};

const sec = (s: number) => Math.round(s * FPS);
const DEFAULT_COLORS = ['#FFC93C', '#F4A261', '#2EC4B6', '#FF4D4D', '#C1121F', '#FFB703', '#9B5DE5', '#3A86FF', '#FF4D9A'];
const scenes: TimelineScene[] = [];
let cursor = 0;

script.chapters.forEach((chapter, chapterIndex) => {
  for (const scene of chapter.scenes) {
    let t = scene.lines.length > 0 ? sec(SCENE_HEAD_SEC) : 0;
    const lines: TimelineLine[] = scene.lines.map((line, i) => {
      const id = lineId(scene, i);
      const m = manifest.lines[id];
      if (!m) throw new Error(`音声がありません: ${id}（tts.ts を再実行してください）`);
      const durationInFrames = Math.ceil(m.durationSec * FPS);
      const out: TimelineLine = {...line, id, from: t, durationInFrames, audio: `audio/${id}.wav`};
      t += durationInFrames;
      if (i < scene.lines.length - 1) t += sec(line.pauseAfterSec ?? script.tts.gapSec);
      return out;
    });
    if (scene.lines.length > 0) t += sec(scene.lines.at(-1)!.pauseAfterSec ?? script.tts.sceneTailSec);
    const durationInFrames = Math.max(t, sec(scene.minDurationSec ?? 0), 1);
    scenes.push({
      id: scene.id,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      chapterIndex,
      accent: chapter.color ?? DEFAULT_COLORS[chapterIndex % DEFAULT_COLORS.length],
      ...(scene.stamp ? {stamp: scene.stamp} : {}),
      from: cursor,
      durationInFrames,
      visual: scene.visual,
      sourceIds: scene.sourceIds,
      lines,
    });
    cursor += durationInFrames;
  }
});

const durationInFrames = cursor;

// ---- 全セリフを 1 本にした narration.wav（フレーム位置どおりに配置）----
const sampleRate = script.tts.sampleRate;
const totalSamples = Math.round((durationInFrames / FPS) * sampleRate);
const mix = new Int16Array(totalSamples);
for (const scene of scenes) {
  for (const line of scene.lines) {
    const pcm = readWav(path.join(episodeDir, line.audio));
    if (pcm.sampleRate !== sampleRate || pcm.channels !== 1) {
      throw new Error(`${line.audio} の形式が違います（${pcm.sampleRate}Hz/${pcm.channels}ch）。tts.ts を --force で再実行してください`);
    }
    const start = Math.round(((scene.from + line.from) / FPS) * sampleRate);
    mix.set(pcm.samples.subarray(0, Math.max(0, Math.min(pcm.samples.length, totalSamples - start))), start);
  }
}
writeWav(path.join(episodeDir, 'audio', 'narration.wav'), {sampleRate, channels: 1, samples: mix});

// ---- BGM（ファイルがあるときだけ有効）----
let bgm: Timeline['bgm'] = null;
if (script.bgm) {
  if (existsSync(path.join(episodeDir, script.bgm.src))) {
    bgm = script.bgm;
  } else {
    console.warn(`BGM なし: ${script.bgm.src} が見つからないので無音で進めます（置けば次回から入ります。音量 ${script.bgm.volume}）`);
  }
}

// ---- 効果音（assets/sfx の自作音をエピソードの sfx/ に写す）----
let sfx: Timeline['sfx'] = null;
if (script.sfx !== false) {
  const from = path.join(ROOT, 'assets', 'sfx');
  if (existsSync(from)) {
    const to = path.join(episodeDir, 'sfx');
    mkdirSync(to, {recursive: true});
    for (const f of readdirSync(from)) if (f.endsWith('.wav')) copyFileSync(path.join(from, f), path.join(to, f));
    sfx = {volume: script.sfx?.volume ?? 0.5};
  } else {
    console.warn('効果音なし: assets/sfx がありません（node scripts/make-sfx.ts で作れます）');
  }
}

// ---- フォント先読み用の文字集合 ----
const strings: string[] = [script.series, script.title, '第章出典：・、。0123456789,.%−-+▲億兆円万年度約'];
const collect = (v: unknown) => {
  if (typeof v === 'string') strings.push(v);
  else if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
};
for (const s of scenes) {
  strings.push(s.chapterTitle);
  s.lines.forEach((l) => strings.push(l.text));
  if (s.stamp) strings.push(s.stamp.text);
  collect(s.visual.props);
}
script.sources.forEach((s) => strings.push(s.short));
const fontText = [...new Set([...strings.join('')])].sort().join('');

const timeline: Timeline = {
  version: 1,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
  series: script.series,
  episode: script.episode,
  title: script.title,
  durationInFrames,
  audioMode: manifest.mode,
  narration: {src: 'audio/narration.wav', durationSec: totalSamples / sampleRate},
  bgm,
  sfx,
  sources: Object.fromEntries(script.sources.map((s) => [s.id, {short: s.short}])),
  fontText,
  scenes,
};
writeJson(path.join(episodeDir, 'timeline.json'), timeline);

const lineCount = scenes.reduce((a, s) => a + s.lines.length, 0);
console.log(
  `timeline.json: ${scenes.length} シーン / ${lineCount} セリフ / ${durationInFrames} フレーム = ${(durationInFrames / FPS).toFixed(1)} 秒（${Math.floor(durationInFrames / FPS / 60)}分${Math.floor((durationInFrames / FPS) % 60)}秒） / 音声 ${manifest.mode}`,
);
