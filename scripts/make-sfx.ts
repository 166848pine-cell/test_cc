// 効果音を ffmpeg で合成して assets/sfx/ に作る（第三者の素材は使わない、すべて自作の波形）。
//   node scripts/make-sfx.ts
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT} from './lib.ts';

const out = path.join(ROOT, 'assets', 'sfx');
mkdirSync(out, {recursive: true});
const enc = ['-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le'];
const sounds: Record<string, string[]> = {
  // ハンコ・着地の「ドン」：下がっていく低音＋短いノイズ
  'don.wav': ['-f', 'lavfi', '-i', "aevalsrc='0.95*sin(2*PI*(95-60*t)*t)*exp(-7*t)+0.35*(random(0)*2-1)*exp(-45*t)':d=0.45:s=48000"],
  // 項目が出る「ピコン」：2 音
  'pikon.wav': ['-f', 'lavfi', '-i', "aevalsrc='0.5*sin(2*PI*1320*t)*exp(-30*t)*lt(t,0.09)+0.5*sin(2*PI*1760*(t-0.08))*exp(-25*(t-0.08))*gte(t,0.08)':d=0.3:s=48000"],
  // 章扉の「ジャン」：長三和音
  'jan.wav': ['-f', 'lavfi', '-i', "aevalsrc='0.28*(sin(2*PI*523.25*t)+sin(2*PI*659.25*t)+sin(2*PI*783.99*t)+0.6*sin(2*PI*1046.5*t))*exp(-3.2*t)*min(1,t*200)':d=0.9:s=48000"],
  // 切り替えの「シュッ」：帯域を絞ったノイズ
  'shu.wav': ['-f', 'lavfi', '-i', 'anoisesrc=d=0.4:c=pink:a=0.6:r=48000', '-af', 'highpass=f=700,lowpass=f=6000,afade=t=in:d=0.18,afade=t=out:st=0.2:d=0.2'],
  // メーター故障の「ボヨン」：揺れながら下がる音
  'boyon.wav': ['-f', 'lavfi', '-i', "aevalsrc='0.6*sin(2*PI*(420-300*t+25*sin(2*PI*14*t))*t)*exp(-2.2*t)':d=0.9:s=48000"],
};
for (const [name, args] of Object.entries(sounds)) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, ...enc, path.join(out, name)], {stdio: 'inherit'});
  if (r.status !== 0) process.exit(1);
}
console.log(`効果音 ${Object.keys(sounds).length} 個: ${out}`);
