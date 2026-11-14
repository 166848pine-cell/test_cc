// script.json の全セリフを VOICEVOX で wav にする。
//   node scripts/tts.ts episodes/001-toshiba            … VOICEVOX で生成（変更のあったセリフだけ作り直す）
//   node scripts/tts.ts episodes/001-toshiba --force    … 全セリフ作り直し
//   node scripts/tts.ts episodes/001-toshiba --silent   … エンジンが使えないときの代用（文字数から尺を見積もった無音 wav）
// 出力: audio/<lineId>.wav と audio/manifest.json（各セリフの長さ・話者 ID・生成方式）
import {existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync} from 'node:fs';
import path from 'node:path';
import {
  episodeDirFromArgs,
  hasFlag,
  loadScript,
  eachLine,
  sha1,
  writeJson,
  wavDurationSec,
  writeWav,
  estimateSpeechSec,
  toSpeech,
} from './lib.ts';
import type {Speaker} from '../remotion/src/types.ts';

type ManifestEntry = {hash: string; durationSec: number; speakerId: number | null; mode: 'voicevox' | 'silent'};
type Manifest = {mode: 'voicevox' | 'silent'; speakers: Record<string, number | null>; lines: Record<string, ManifestEntry>};

const episodeDir = episodeDirFromArgs();
const script = loadScript(episodeDir);
const tts = script.tts;
const audioDir = path.join(episodeDir, 'audio');
mkdirSync(audioDir, {recursive: true});
const manifestPath = path.join(audioDir, 'manifest.json');
const silent = hasFlag('silent');
const force = hasFlag('force');

const engine = process.env.VOICEVOX_URL ?? tts.engineUrl;

async function engineAlive(): Promise<string | null> {
  try {
    const res = await fetch(`${engine}/version`, {signal: AbortSignal.timeout(3000)});
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

type SpeakerInfo = {name: string; styles: {name: string; id: number}[]};

async function resolveSpeakerIds(): Promise<Record<Speaker, number>> {
  const res = await fetch(`${engine}/speakers`);
  if (!res.ok) throw new Error(`/speakers が失敗: ${res.status}`);
  const list = (await res.json()) as SpeakerInfo[];
  const out = {} as Record<Speaker, number>;
  for (const [key, want] of Object.entries(tts.speakers) as [Speaker, {name: string; style: string}][]) {
    const sp = list.find((s) => s.name === want.name);
    const style = sp?.styles.find((st) => st.name === want.style);
    if (!style) {
      throw new Error(`話者が見つかりません: ${want.name}（${want.style}）。/speakers の一覧を確認してください`);
    }
    out[key] = style.id;
  }
  return out;
}

async function synthesize(text: string, speakerId: number): Promise<Buffer> {
  const q = await fetch(`${engine}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`, {method: 'POST'});
  if (!q.ok) throw new Error(`audio_query 失敗 (${q.status}): ${text}`);
  const query = (await q.json()) as Record<string, unknown>;
  query.speedScale = tts.speedScale;
  query.intonationScale = tts.intonationScale;
  query.volumeScale = tts.volumeScale;
  query.outputSamplingRate = tts.sampleRate;
  query.outputStereo = false;
  query.prePhonemeLength = 0.05;
  query.postPhonemeLength = 0.05;
  const s = await fetch(`${engine}/synthesis?speaker=${speakerId}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(query),
  });
  if (!s.ok) throw new Error(`synthesis 失敗 (${s.status}): ${text}`);
  return Buffer.from(await s.arrayBuffer());
}

const main = async () => {
  let speakerIds: Record<Speaker, number> | null = null;
  if (!silent) {
    const version = await engineAlive();
    if (!version) {
      console.error(
        [
          `VOICEVOX Engine に接続できません: ${engine}`,
          '起動例（Docker）: docker run --rm -p 50021:50021 voicevox/voicevox_engine:cpu-latest',
          'どうしても使えない場合は --silent を付けると、文字数から尺を見積もった無音 wav で先に進めます。',
        ].join('\n'),
      );
      process.exit(2);
    }
    speakerIds = await resolveSpeakerIds();
    console.log(`VOICEVOX ${version.replace(/"/g, '')} / 話者 ID:`, speakerIds);
  }

  const prev: Manifest | null = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const manifest: Manifest = {
    mode: silent ? 'silent' : 'voicevox',
    speakers: speakerIds ?? {zundamon: null, metan: null},
    lines: {},
  };

  let made = 0;
  let kept = 0;
  for (const {line, id} of eachLine(script)) {
    const say = toSpeech(line.yomi ?? line.text);
    const speakerId = speakerIds ? speakerIds[line.speaker] : null;
    const hash = sha1(JSON.stringify([say, line.speaker, speakerId, manifest.mode, tts.speedScale, tts.intonationScale, tts.volumeScale, tts.sampleRate]));
    const file = path.join(audioDir, `${id}.wav`);
    const old = prev?.lines[id];
    if (!force && old && old.hash === hash && existsSync(file)) {
      manifest.lines[id] = old;
      kept++;
      continue;
    }
    if (silent) {
      const sec = estimateSpeechSec(say, tts.speedScale);
      writeWav(file, {sampleRate: tts.sampleRate, channels: 1, samples: new Int16Array(Math.round(sec * tts.sampleRate))});
    } else {
      writeFileSync(file, await synthesize(say, speakerId as number));
    }
    const durationSec = wavDurationSec(file);
    manifest.lines[id] = {hash, durationSec, speakerId, mode: manifest.mode};
    made++;
    process.stdout.write(`\r生成 ${made} / 再利用 ${kept}   `);
  }

  // 台本から消えたセリフの wav を掃除
  const valid = new Set(Object.keys(manifest.lines).map((id) => `${id}.wav`));
  for (const f of readdirSync(audioDir)) {
    if (/^ch.*\.wav$/.test(f) && !valid.has(f)) unlinkSync(path.join(audioDir, f));
  }

  writeJson(manifestPath, manifest);
  const total = Object.values(manifest.lines).reduce((a, b) => a + b.durationSec, 0);
  console.log(`\n完了: ${Object.keys(manifest.lines).length} セリフ（新規 ${made}、再利用 ${kept}）、発話合計 ${total.toFixed(1)} 秒、方式 ${manifest.mode}`);
  if (silent) console.warn('注意: 無音の代用ファイルです。本番前に VOICEVOX で作り直してください。');
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
