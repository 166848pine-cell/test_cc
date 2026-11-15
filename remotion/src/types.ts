// script.json と timeline.json の型。scripts/*.ts からも import type で参照する。

export type Speaker = 'zundamon' | 'metan';
export type Emotion = 'normal' | 'surprised' | 'sad' | 'happy';

// ---------- シーン部品の props ----------

export type TitleProps = {
  /** "episode" は回のタイトル画面、"chapter" は章の扉 */
  variant?: 'episode' | 'chapter';
  /** 例: "第1章" */
  kicker?: string;
  title: string;
  subtitle?: string;
};

export type TimelineItem = {
  year: string;
  label: string;
  /** このセリフ番号（0 始まり）が始まった時に表示。省略時はシーン内で均等に表示 */
  atLine?: number;
  highlight?: boolean;
};
export type TimelineProps = {heading?: string; items: TimelineItem[]};

export type BigNumberProps = {
  heading?: string;
  /** 表示する値（例: "4兆円"）。countTo があればカウントアップ後にこの表記で止まる */
  value: string;
  /** カウントアップの到達値（億円単位）。指定時は "◯兆◯億円" 表記でカウントアップする */
  countToOku?: number;
  caption?: string;
  /** 換算のサブ表示（例: うまい棒換算） */
  conversion?: {label: string; value: string; note?: string; atLine?: number};
  tone?: 'plus' | 'minus' | 'neutral';
};

export type BarDatum = {label: string; value: number; note?: string};
export type BarChartProps = {
  heading?: string;
  unit: string;
  bars: BarDatum[];
  /** 強調するバーの label */
  highlight?: string[];
  footnote?: string;
};

export type TransferItem = {
  what: string;
  to: string;
  when?: string;
  detail?: string;
  atLine?: number;
};
export type TransferMapProps = {heading?: string; from: string; items: TransferItem[]};

export type QuoteProps = {text: string; cite: string; note?: string};

export type MeterProps = {
  label?: string;
  /** 0〜100。100 を超えると針が振り切れて「測定不能」になる */
  level: number;
  /** 針の出発点（前の章の値） */
  from?: number;
  caption?: string;
};

export type Visual =
  | {type: 'title'; props: TitleProps}
  | {type: 'timeline'; props: TimelineProps}
  | {type: 'bigNumber'; props: BigNumberProps}
  | {type: 'barChart'; props: BarChartProps}
  | {type: 'transferMap'; props: TransferMapProps}
  | {type: 'quote'; props: QuoteProps}
  | {type: 'meter'; props: MeterProps};

// ---------- script.json ----------

export type ScriptLine = {
  speaker: Speaker;
  /** 字幕に出す文。{ } で囲んだ部分は黄色で強調される（音声では読まない） */
  text: string;
  /** 音声合成に使う読み（省略時は text） */
  yomi?: string;
  emotion?: Emotion;
  /** 事実の主張を含まない冗談（数値チェックの対象外。例：ずんだもんのおやつの数） */
  joke?: boolean;
  /** このセリフの後の間（秒）。省略時は tts.gapSec */
  pauseAfterSec?: number;
};

export type Fact = {text: string; sourceIds: string[]};

export type ScriptScene = {
  id: string;
  visual: Visual;
  lines: ScriptLine[];
  sourceIds: string[];
  /** このシーンで述べている事実（sources.md の元になる） */
  facts?: Fact[];
  /** セリフが無い・短いときの最短尺（秒） */
  minDurationSec?: number;
  /** ハンコ演出（atLine 番目のセリフで押される） */
  stamp?: Stamp;
};

export type Stamp = {text: string; atLine?: number};

export type Chapter = {
  id: string;
  title: string;
  /** 章のテーマ色（省略時はシリーズ既定の色を順に使う） */
  color?: string;
  scenes: ScriptScene[];
};

export type Source = {
  id: string;
  /** 画面下に出す短い表記 */
  short: string;
  title: string;
  publisher: string;
  url: string;
  date?: string;
  kind: 'primary' | 'press' | 'other';
};

export type TtsSettings = {
  engineUrl: string;
  speakers: Record<Speaker, {name: string; style: string}>;
  speedScale: number;
  intonationScale: number;
  volumeScale: number;
  /** セリフ間の標準の間（秒） */
  gapSec: number;
  /** シーン末尾の余白（秒） */
  sceneTailSec: number;
  sampleRate: number;
};

export type Script = {
  series: string;
  episode: number;
  title: string;
  company: string;
  /** YouTube 概要欄の冒頭に使う紹介文 */
  description: string;
  /** 個人名など、台本に出してはいけない語（check-script.ts が検査） */
  bannedWords?: string[];
  tts: TtsSettings;
  bgm?: {src: string; volume: number};
  /** 効果音（assets/sfx の自作音）。false で無効、数値で全体の音量 */
  sfx?: false | {volume: number};
  sources: Source[];
  chapters: Chapter[];
};

// ---------- timeline.json ----------

export type TimelineLine = ScriptLine & {
  id: string;
  /** シーン先頭からの開始フレーム */
  from: number;
  durationInFrames: number;
  audio: string;
};

export type TimelineScene = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  /** 章のテーマ色 */
  accent: string;
  stamp?: Stamp;
  /** 動画先頭からの開始フレーム */
  from: number;
  durationInFrames: number;
  visual: Visual;
  sourceIds: string[];
  lines: TimelineLine[];
};

export type Timeline = {
  version: 1;
  fps: number;
  width: number;
  height: number;
  series: string;
  episode: number;
  title: string;
  durationInFrames: number;
  audioMode: 'voicevox' | 'silent';
  narration: {src: string; durationSec: number} | null;
  bgm: {src: string; volume: number} | null;
  /** 効果音の全体音量（null なら効果音なし） */
  sfx: {volume: number} | null;
  sources: Record<string, {short: string}>;
  /** 動画内で使う全文字（フォントの先読み用） */
  fontText: string;
  scenes: TimelineScene[];
};
