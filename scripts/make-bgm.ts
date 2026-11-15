// シリーズ既定の BGM を、コードで合成して assets/bgm/yarakashi-theme.wav に作る（第三者の素材は使わない）。
//   node scripts/make-bgm.ts
// 明るくて少しとぼけた曲調：124BPM・ハ長調・32 小節（約 62 秒）。最後の音の余韻を頭に重ねて、継ぎ目なくループする。
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {ROOT, writeWav} from './lib.ts';

const SR = 48000;
const BPM = 124;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BARS = 32;
const LEN = Math.round(BAR * BARS * SR);
const buf = new Float32Array(LEN);

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// 決まった種の乱数（毎回同じ音になるように）
let seed = 12345;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

/** 音を足す（はみ出した余韻は先頭に回してループをつなぐ） */
function add(startSec: number, durSec: number, gen: (t: number, i: number) => number) {
  const s0 = Math.round(startSec * SR);
  const n = Math.round(durSec * SR);
  for (let i = 0; i < n; i++) buf[(s0 + i) % LEN] += gen(i / SR, i);
}

type Wave = 'sine' | 'tri' | 'pulse';
const osc = (wave: Wave, f: number, t: number) => {
  const ph = (f * t) % 1;
  if (wave === 'sine') return Math.sin(2 * Math.PI * ph);
  if (wave === 'tri') return 4 * Math.abs(ph - 0.5) - 1;
  return ph < 0.3 ? 0.8 : -0.8;
};

function note(start: number, dur: number, midi: number, wave: Wave, amp: number, decay: number, attack = 0.004) {
  const f = midiHz(midi);
  let lp = 0; // 角を丸める一次ローパス
  add(start, dur + 0.25, (t) => {
    const env = Math.min(1, t / attack) * Math.exp(-t * decay) * (t < dur ? 1 : Math.exp(-(t - dur) * 30));
    const x = osc(wave, f, t) * env * amp;
    lp += (x - lp) * (wave === 'pulse' ? 0.18 : 0.6);
    return lp;
  });
}

const kick = (s: number) => {
  let ph = 0;
  add(s, 0.3, (t) => {
    const f = 45 + 105 * Math.exp(-t * 28);
    ph += f / SR;
    return Math.sin(2 * Math.PI * ph) * Math.exp(-t * 14) * 0.55;
  });
};
const snare = (s: number) => {
  let prev = 0;
  add(s, 0.22, (t) => {
    const n = rand() * 2 - 1;
    const hp = n - prev;
    prev = n;
    return hp * Math.exp(-t * 26) * 0.16 + Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 22) * 0.12;
  });
};
const hat = (s: number, amp = 0.05) => {
  let prev = 0;
  add(s, 0.06, (t) => {
    const n = rand() * 2 - 1;
    const hp = n - prev;
    prev = n;
    return hp * Math.exp(-t * 70) * amp;
  });
};

// コード進行（ルートの MIDI 番号と長短）。A：C G Am F ×2、B：F G Em Am / F G C C
type Chord = {root: number; minor: boolean};
const C = (root: number, minor = false): Chord => ({root, minor});
const A_PART = [C(48), C(55), C(57, true), C(53)];
const B_PART = [C(53), C(55), C(52, true), C(57, true), C(53), C(55), C(48), C(48)];
const progression = [...A_PART, ...A_PART, ...B_PART, ...A_PART, ...A_PART, ...B_PART];

// 主旋律の型（8 分音符 8 個。数字はコードの音：0=根音 1=3度 2=5度 3=オクターブ上、null=休み）
const LEAD_PATTERNS: (number | null)[][] = [
  [3, null, 2, 1, null, 2, 3, null],
  [2, 1, null, 0, 1, null, 2, 1],
  [3, 3, null, 2, 1, 2, null, 0],
  [null, 2, 3, null, 2, 1, 0, null],
];

progression.forEach((ch, bar) => {
  const t0 = bar * BAR;
  const third = ch.minor ? 3 : 4;
  const tones = [0, third, 7, 12];
  const section = bar < 16 ? 'A' : 'B';
  // ベース：8 分音符で跳ねる（根音とオクターブ上を交互に）
  for (let k = 0; k < 8; k++) {
    const m = ch.root - 12 + (k % 2 === 1 ? 12 : 0) + (k === 6 ? 7 : 0);
    note(t0 + k * (BEAT / 2), BEAT * 0.32, m, 'pulse', 0.22, 6);
  }
  // 裏拍のコード（ポン、ポン）
  for (let b = 0; b < 4; b++) {
    for (const iv of [0, third, 7]) note(t0 + b * BEAT + BEAT / 2, BEAT * 0.18, ch.root + 12 + iv, 'tri', 0.07, 10);
  }
  // 主旋律（ピチカート風）。4 小節ごとに型を変え、最初の 2 小節は入らない
  if (bar >= 2) {
    const pat = LEAD_PATTERNS[(Math.floor(bar / 2) + (section === 'B' ? 1 : 0)) % LEAD_PATTERNS.length];
    pat.forEach((deg, k) => {
      if (deg === null) return;
      note(t0 + k * (BEAT / 2), BEAT * 0.4, ch.root + 24 + tones[deg], 'sine', 0.16, 9);
      note(t0 + k * (BEAT / 2), BEAT * 0.4, ch.root + 36 + tones[deg], 'sine', 0.03, 14); // 倍音で明るく
    });
  }
  // ドラム
  kick(t0);
  kick(t0 + 2 * BEAT);
  if (bar % 4 === 3) kick(t0 + 3.5 * BEAT);
  snare(t0 + BEAT);
  snare(t0 + 3 * BEAT);
  for (let k = 0; k < 8; k++) hat(t0 + k * (BEAT / 2), k % 2 === 1 ? 0.06 : 0.035);
});

// 音量を整える（ピーク -3dB 程度）
let peak = 0;
for (const v of buf) peak = Math.max(peak, Math.abs(v));
const gain = 0.7 / (peak || 1);
const pcm = new Int16Array(LEN);
for (let i = 0; i < LEN; i++) pcm[i] = Math.max(-32767, Math.min(32767, Math.round(buf[i] * gain * 32767)));

const outDir = path.join(ROOT, 'assets', 'bgm');
mkdirSync(outDir, {recursive: true});
const out = path.join(outDir, 'yarakashi-theme.wav');
writeWav(out, {sampleRate: SR, channels: 1, samples: pcm});
console.log(`BGM: ${out}（${(LEN / SR).toFixed(1)} 秒・${BPM}BPM・${BARS} 小節、ループ用）`);
