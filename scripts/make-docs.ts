// script.json から人間向けの文書を作る。
//   node scripts/make-docs.ts episodes/001-toshiba
// 出力:
//   sources.md   … 動画内で使った事実と出典の対応表（全ての数値に出典があるかの検査つき）
//   script.md    … 人間が読む用の台本
//   credits.json … クレジットと YouTube 概要欄用テキスト（bgm・extra は手で書いた内容を保持）
//   description.txt … 概要欄テキスト（credits.json の youtubeDescription と同じ）
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {episodeDirFromArgs, loadScript, writeJson} from './lib.ts';
import type {Timeline, Visual} from '../remotion/src/types.ts';

const episodeDir = episodeDirFromArgs();
const script = loadScript(episodeDir);
const srcById = new Map(script.sources.map((s) => [s.id, s]));
const NAME = {zundamon: 'ずんだもん', metan: '四国めたん'} as const;
const EMO = {normal: '', surprised: '（驚き）', sad: '（しょんぼり）', happy: '（うれしい）'} as const;
const timelinePath = path.join(episodeDir, 'timeline.json');
const timeline: Timeline | null = existsSync(timelinePath) ? JSON.parse(readFileSync(timelinePath, 'utf8')) : null;

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const link = (id: string) => {
  const s = srcById.get(id);
  return s ? `[${id}](${s.url})` : `${id}（不明）`;
};

function describeVisual(v: Visual): string {
  switch (v.type) {
    case 'title':
      return `扉「${[v.props.kicker, v.props.title].filter(Boolean).join(' ')}」${v.props.subtitle ? `（${v.props.subtitle}）` : ''}`;
    case 'timeline':
      return `年表「${v.props.heading ?? ''}」：${v.props.items.map((i) => `${i.year} ${i.label}`).join(' / ')}`;
    case 'bigNumber':
      return `大きな数字「${v.props.value}」${v.props.heading ? `（${v.props.heading}）` : ''}${v.props.caption ? ` ／ ${v.props.caption}` : ''}${v.props.conversion ? ` ／ ${v.props.conversion.label}：${v.props.conversion.value}` : ''}`;
    case 'barChart':
      return `棒グラフ「${v.props.heading ?? ''}」：${v.props.bars.map((b) => `${b.label} ${b.value.toLocaleString('ja-JP')}`).join(' / ')}（${v.props.unit}）`;
    case 'transferMap':
      return `売却図「${v.props.heading ?? ''}」：${v.props.items.map((i) => `${i.what}→${i.to}（${[i.when, i.detail].filter(Boolean).join('・')}）`).join(' / ')}`;
    case 'quote':
      return `引用「${v.props.text}」— ${v.props.cite}`;
    case 'meter':
      return `やらかし度メーター ${v.props.from ?? 0} → ${v.props.level}${v.props.caption ? `（${v.props.caption}）` : ''}`;
  }
}

// ---------- script.md ----------
const sceneStart = new Map(timeline?.scenes.map((s) => [s.id, s.from / timeline.fps]) ?? []);
const md: string[] = [`# ${script.title}`, '', `シリーズ「${script.series}」第${script.episode}回 ／ 題材：${script.company}`, ''];
if (timeline) md.push(`尺：${mmss(timeline.durationInFrames / timeline.fps)}（音声：${timeline.audioMode === 'voicevox' ? 'VOICEVOX' : '無音の代用'}）`, '');
let chars = 0;
let lines = 0;
for (const ch of script.chapters) {
  md.push(`## ${ch.title}`, '');
  for (const sc of ch.scenes) {
    const t = sceneStart.get(sc.id);
    md.push(`**[${sc.id}]${t !== undefined ? ` ${mmss(t)}` : ''}** 画面：${describeVisual(sc.visual)}${sc.stamp ? ` ／ ハンコ「${sc.stamp.text}」` : ''}`, '');
    for (const [i, l] of sc.lines.entries()) {
      const plain = l.text.replace(/[{}]/g, '');
      md.push(`- **${NAME[l.speaker]}**${EMO[l.emotion ?? 'normal']}${l.joke ? '〔冗談〕' : ''}：${l.text.replace(/\{([^}]*)\}/g, '**$1**')}${l.yomi ? `　〔読み：${l.yomi}〕` : ''}`);
      chars += [...plain].length;
      lines++;
      void i;
    }
    if (sc.lines.length) md.push('');
    if (sc.sourceIds.length) md.push(`出典：${sc.sourceIds.map(link).join('、')}`, '');
  }
}
md.push('---', '', `${lines} セリフ ／ ${chars} 文字`);
writeFileSync(path.join(episodeDir, 'script.md'), md.join('\n') + '\n');

// ---------- sources.md ----------
const numRe = /\d[\d,.]*/;
const out: string[] = [
  `# 出典対応表 — ${script.title}`,
  '',
  'このファイルは `node scripts/make-docs.ts` が script.json から生成する。',
  '「事実」は各シーンの `facts`、「画面・セリフの数値」はそのシーンのセリフと図に出てくる数値。',
  '',
  '| シーン | 事実（動画内で使ったもの） | 出典 |',
  '|---|---|---|',
];
const problems: string[] = [];
for (const ch of script.chapters) {
  for (const sc of ch.scenes) {
    const facts = sc.facts ?? [];
    const hasNumbers = sc.lines.some((l) => numRe.test(l.text)) || (sc.visual.type !== 'meter' && sc.visual.type !== 'title' && numRe.test(JSON.stringify(sc.visual.props)));
    if (hasNumbers && facts.length === 0) problems.push(`${sc.id}: 数値があるのに facts がない`);
    for (const f of facts) {
      if (f.sourceIds.length === 0) problems.push(`${sc.id}: 「${f.text}」に出典がない`);
      out.push(`| ${sc.id} | ${f.text.replace(/\|/g, '｜')} | ${f.sourceIds.map(link).join('<br>')} |`);
    }
  }
}
out.push('', '## 出典一覧', '', '| ID | 種別 | 発行者 | タイトル | 日付 | URL |', '|---|---|---|---|---|---|');
const KIND = {primary: '一次', press: '報道', other: 'その他'} as const;
for (const s of script.sources) {
  out.push(`| ${s.id} | ${KIND[s.kind]} | ${s.publisher} | ${s.title.replace(/\|/g, '｜')} | ${s.date ?? '—'} | ${s.url} |`);
}
out.push('', '## 検査結果', '', problems.length ? problems.map((p) => `- ${p}`).join('\n') : '- 数値を含む全シーンに、出典つきの facts がある（詳細な数値ごとの照合は `npm run check` で実施）');
writeFileSync(path.join(episodeDir, 'sources.md'), out.join('\n') + '\n');

// ---------- credits.json / description.txt ----------
const creditsPath = path.join(episodeDir, 'credits.json');
const prev = existsSync(creditsPath) ? JSON.parse(readFileSync(creditsPath, 'utf8')) : {};
const voices = ['VOICEVOX:ずんだもん', 'VOICEVOX:四国めたん'];
const fonts = [
  'M PLUS Rounded 1c（SIL Open Font License 1.1）',
  'Dela Gothic One（SIL Open Font License 1.1）',
];
const tools = ['Remotion', 'VOICEVOX'];
const bgm: string[] = prev.bgm ?? [];
const extra: string[] = prev.extra ?? [];

const chapterTimes = timeline
  ? script.chapters.map((ch) => {
      const first = timeline.scenes.find((s) => s.chapterId === ch.id);
      return `${mmss((first?.from ?? 0) / timeline.fps)} ${ch.title}`;
    })
  : [];
const primary = script.sources.filter((s) => s.kind === 'primary');
const press = script.sources.filter((s) => s.kind !== 'primary');
const desc = [
  script.description,
  '',
  ...(chapterTimes.length ? ['■ 目次', ...chapterTimes, ''] : []),
  '■ 主な出典（一次情報）',
  ...primary.map((s) => `・${s.publisher}「${s.title}」${s.date ? `（${s.date}）` : ''} ${s.url}`),
  '',
  '■ 補強に使った報道など',
  ...press.map((s) => `・${s.publisher}「${s.title}」${s.date ? `（${s.date}）` : ''} ${s.url}`),
  '',
  '※ 本動画は公開資料と報道をもとに構成しています。評価や推測を含む部分は「〜とされる」「報道によれば」と区別しています。',
  '※ 社名・番組名などはテキストで記載しており、各社のロゴや画像は使用していません。',
  '',
  '■ クレジット',
  ...voices,
  ...(bgm.length ? bgm.map((b) => `BGM：${b}`) : ['BGM：（素材を入れたらここに記載）']),
  ...extra,
  '効果音：自作（ffmpeg で波形から合成）',
  `フォント：${fonts.join('、')}`,
  `制作ツール：${tools.join('、')}`,
].join('\n');

writeJson(creditsPath, {
  voices,
  fonts,
  tools,
  bgm,
  extra,
  note: 'bgm と extra は手で編集してよい（make-docs.ts は保持する）。youtubeDescription は自動生成。',
  youtubeDescription: desc,
});
writeFileSync(path.join(episodeDir, 'description.txt'), desc + '\n');

console.log(`script.md（${lines} セリフ）、sources.md（facts ${script.chapters.flatMap((c) => c.scenes).reduce((a, s) => a + (s.facts?.length ?? 0), 0)} 件）、credits.json、description.txt を作成`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
