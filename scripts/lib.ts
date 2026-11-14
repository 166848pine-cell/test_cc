// パイプライン共通の小さな関数群（依存パッケージなし。Node 22 の型ストリップで実行）
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import type {Script, ScriptLine, ScriptScene, Chapter} from '../remotion/src/types.ts';

export const ROOT = path.resolve(import.meta.dirname, '..');

/** コマンドライン第1引数のエピソードディレクトリを絶対パスで返す */
export function episodeDirFromArgs(): string {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!arg) {
    console.error('使い方: node scripts/<name>.ts episodes/<NNN-company> [オプション]');
    process.exit(1);
  }
  const dir = path.resolve(process.cwd(), arg);
  if (!existsSync(path.join(dir, 'script.json'))) {
    console.error(`script.json が見つかりません: ${dir}`);
    process.exit(1);
  }
  return dir;
}

export const hasFlag = (name: string) => process.argv.includes(`--${name}`);

export function loadScript(episodeDir: string): Script {
  return JSON.parse(readFileSync(path.join(episodeDir, 'script.json'), 'utf8')) as Script;
}

export function writeJson(file: string, data: unknown) {
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

/** セリフの ID（= wav のファイル名）。例: ch1-s2-03 */
export const lineId = (scene: ScriptScene, index: number) =>
  `${scene.id}-${String(index + 1).padStart(2, '0')}`;

export function* eachLine(script: Script): Generator<{
  chapter: Chapter;
  scene: ScriptScene;
  line: ScriptLine;
  index: number;
  id: string;
}> {
  for (const chapter of script.chapters) {
    for (const scene of chapter.scenes) {
      for (const [index, line] of scene.lines.entries()) {
        yield {chapter, scene, line, index, id: lineId(scene, index)};
      }
    }
  }
}

export const sha1 = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16);

// ---------- WAV（PCM 16bit）----------

export type Pcm = {sampleRate: number; channels: number; samples: Int16Array};

export function readWav(file: string): Pcm {
  const buf = readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`WAV ではありません: ${file}`);
  }
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bits = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      if (bits !== 16) throw new Error(`16bit PCM のみ対応: ${file} (${bits}bit)`);
      const end = Math.min(body + size, buf.length);
      const copy = Buffer.from(buf.subarray(body, end - ((end - body) % 2)));
      const samples = new Int16Array(copy.buffer, copy.byteOffset, copy.length / 2);
      return {sampleRate, channels, samples};
    }
    offset = body + size + (size % 2);
  }
  throw new Error(`data チャンクがありません: ${file}`);
}

export function wavDurationSec(file: string): number {
  const {sampleRate, channels, samples} = readWav(file);
  return samples.length / channels / sampleRate;
}

export function writeWav(file: string, pcm: Pcm) {
  const dataBytes = pcm.samples.length * 2;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(pcm.channels, 22);
  header.writeUInt32LE(pcm.sampleRate, 24);
  header.writeUInt32LE(pcm.sampleRate * pcm.channels * 2, 28);
  header.writeUInt16LE(pcm.channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataBytes, 40);
  const data = Buffer.from(pcm.samples.buffer, pcm.samples.byteOffset, dataBytes);
  writeFileSync(file, Buffer.concat([header, data]));
}

/** 文字数から読み上げ時間を見積もる（VOICEVOX 不使用時の代用） */
export function estimateSpeechSec(text: string, speedScale: number): number {
  const chars = [...text.replace(/[\s「」『』（）()、。！？!?…ー―・]/g, '')].length;
  // 標準速度でおおむね 1 文字 0.17 秒程度（数字は読みが長いので加算）
  const digits = (text.match(/[0-9０-９]/g) ?? []).length;
  return (chars * 0.17 + digits * 0.1 + 0.3) / speedScale;
}

/** 音声合成に渡す文に整える（数字の桁区切りカンマを外す。例: 4,673 → 4673） */
export const toSpeech = (text: string) => text.replace(/(\d),(?=\d{3})/g, '$1');
