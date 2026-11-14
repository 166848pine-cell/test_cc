// script.json の検査。
//   node scripts/check-script.ts episodes/001-toshiba
// - 出典 ID の参照切れ／未使用
// - 数値（年・金額・割合など）を含むセリフや図に、同じ数値を含む facts（出典つき）があるか
// - 字幕の長さ、禁止語（個人名など）、話者・感情・図の種類
// - 文字数からの尺の見積もり
import {episodeDirFromArgs, loadScript, lineId, estimateSpeechSec} from './lib.ts';

const VISUALS = ['title', 'timeline', 'bigNumber', 'barChart', 'transferMap', 'quote', 'meter'];
const SPEAKERS = ['zundamon', 'metan'];
const EMOTIONS = ['normal', 'surprised', 'sad', 'happy'];
const MAX_SUBTITLE = 60;

const episodeDir = episodeDirFromArgs();
const script = loadScript(episodeDir);
const errors: string[] = [];
const warnings: string[] = [];

const sourceIds = new Set(script.sources.map((s) => s.id));
const usedSources = new Set<string>();

/** 文から「数値」を取り出す（第1章・1つ・2人 などの数え言葉は除外） */
function numbersIn(text: string): string[] {
  const t = text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const found = t.match(/\d[\d,.]*/g) ?? [];
  return found
    .filter((n, i, arr) => {
      const idx = t.indexOf(n);
      const after = t.slice(idx + n.length, idx + n.length + 1);
      const before = t.slice(Math.max(0, idx - 1), idx);
      if (before === '第' || /[つ人回本枚個点問章]/.test(after)) return false;
      return arr.indexOf(n) === i;
    })
    .map((n) => n.replace(/,/g, '').replace(/\.$/, ''));
}
const norm = (s: string) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/,/g, '');

let estSec = 0;
let chars = 0;
let lineCount = 0;
const sceneIds = new Set<string>();

for (const chapter of script.chapters) {
  for (const scene of chapter.scenes) {
    if (sceneIds.has(scene.id)) errors.push(`${scene.id}: シーン ID が重複`);
    sceneIds.add(scene.id);
    if (!VISUALS.includes(scene.visual.type)) errors.push(`${scene.id}: 不明な visual.type "${scene.visual.type}"`);
    for (const id of scene.sourceIds) {
      if (!sourceIds.has(id)) errors.push(`${scene.id}: 出典 ${id} が sources にない`);
      usedSources.add(id);
    }
    const facts = scene.facts ?? [];
    for (const f of facts) {
      if (f.sourceIds.length === 0) errors.push(`${scene.id}: facts「${f.text}」に出典がない`);
      for (const id of f.sourceIds) {
        if (!sourceIds.has(id)) errors.push(`${scene.id}: facts の出典 ${id} が sources にない`);
        if (!scene.sourceIds.includes(id)) warnings.push(`${scene.id}: facts の出典 ${id} がシーンの sourceIds（画面下の表示）に入っていない`);
        usedSources.add(id);
      }
    }
    const factText = norm(facts.map((f) => f.text).join(' / '));

    // 数値チェック（セリフ＋図）
    const texts: {where: string; text: string}[] = scene.lines.map((l, i) => ({where: lineId(scene, i), text: l.text}));
    const collect = (v: unknown, where: string) => {
      if (typeof v === 'string') texts.push({where, text: v});
      else if (Array.isArray(v)) v.forEach((x) => collect(x, where));
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          if (['kicker', 'atLine', 'level', 'from'].includes(k)) continue;
          if (typeof x === 'number' && k === 'value') texts.push({where: `${where}.${k}`, text: String(x)});
          else if (typeof x === 'number' && k === 'countToOku') texts.push({where: `${where}.${k}`, text: String(x)});
          else collect(x, `${where}`);
        }
      }
    };
    if (scene.visual.type !== 'meter' && scene.visual.type !== 'title') collect(scene.visual.props, `${scene.id}.visual`);
    for (const {where, text} of texts) {
      for (const n of numbersIn(text)) {
        if (!factText.includes(n.replace(/^-/, ''))) {
          errors.push(`${where}: 数値「${n}」を含むが、同じ数値を含む facts（出典つき）がない → 「${text}」`);
        }
      }
    }

    for (const [i, line] of scene.lines.entries()) {
      const id = lineId(scene, i);
      lineCount++;
      chars += [...line.text].length;
      estSec += estimateSpeechSec(line.yomi ?? line.text, script.tts.speedScale) + (line.pauseAfterSec ?? script.tts.gapSec);
      if (!SPEAKERS.includes(line.speaker)) errors.push(`${id}: 不明な話者 ${line.speaker}`);
      if (line.emotion && !EMOTIONS.includes(line.emotion)) errors.push(`${id}: 不明な emotion ${line.emotion}`);
      if ([...line.text].length > MAX_SUBTITLE) warnings.push(`${id}: 字幕が ${[...line.text].length} 文字（${MAX_SUBTITLE} 文字以内推奨）`);
    }
    estSec += script.tts.sceneTailSec + 0.3;
    if (scene.lines.length === 0) estSec += scene.minDurationSec ?? 0;
  }
}

for (const id of sourceIds) if (!usedSources.has(id)) warnings.push(`出典 ${id} はどのシーンでも使われていない`);

const all = JSON.stringify(script.chapters);
for (const w of script.bannedWords ?? []) {
  if (all.includes(w)) errors.push(`禁止語「${w}」が台本に含まれている`);
}

for (const w of warnings) console.warn(`[注意] ${w}`);
for (const e of errors) console.error(`[エラー] ${e}`);
console.log(
  `\n${script.chapters.length} 章 / ${sceneIds.size} シーン / ${lineCount} セリフ / ${chars} 文字 / 推定 ${Math.floor(estSec / 60)}分${Math.round(estSec % 60)}秒（VOICEVOX の実測で変わります）`,
);
console.log(errors.length ? `エラー ${errors.length} 件` : 'エラーなし');
process.exit(errors.length ? 1 : 0);
