/**
 * ピンと情報ブロックの見た目(色・大きさ)の定義と解決(すべて純粋関数)。
 *
 * 全体の既定と、地点ごとの上書きの2段構えにしている。
 * 地点ごとに指定が無ければ全体の設定を使い、全体にも無ければ既定色・標準サイズになる。
 */

export interface MarkerStyle {
  /** パレットのキー。未設定なら上位の設定に従う。 */
  color?: string;
  /** 大きさのキー。未設定なら上位の設定に従う。 */
  size?: string;
}

export interface PaletteEntry {
  key: string;
  label: string;
  /** マーカー・ブロック見出し・引き出し線に使う色。 */
  color: string;
  /** ホバー時などに使う濃いめの色。 */
  strong: string;
}

/** 地図の上でも見分けやすい6色。 */
export const PALETTE: PaletteEntry[] = [
  { key: 'orange', label: 'オレンジ', color: '#e4572e', strong: '#c8431e' },
  { key: 'blue', label: 'ブルー', color: '#2f6fd0', strong: '#2559a8' },
  { key: 'green', label: 'グリーン', color: '#1b8a5a', strong: '#146b45' },
  { key: 'purple', label: 'パープル', color: '#7b4bc9', strong: '#6339a6' },
  { key: 'red', label: 'レッド', color: '#c62828', strong: '#a01f1f' },
  { key: 'slate', label: 'グレー', color: '#4a5568', strong: '#37414f' },
];

export const DEFAULT_COLOR_KEY = 'orange';

export interface SizeEntry {
  key: string;
  label: string;
  /** 標準を1とした倍率。 */
  scale: number;
}

export const SIZES: SizeEntry[] = [
  { key: 's', label: '小', scale: 0.82 },
  { key: 'm', label: '中', scale: 1 },
  { key: 'l', label: '大', scale: 1.24 },
];

export const DEFAULT_SIZE_KEY = 'm';

export interface ResolvedAppearance {
  colorKey: string;
  color: string;
  strong: string;
  sizeKey: string;
  scale: number;
}

function findColor(key: string | undefined): PaletteEntry | undefined {
  return key === undefined ? undefined : PALETTE.find((p) => p.key === key);
}

function findSize(key: string | undefined): SizeEntry | undefined {
  return key === undefined ? undefined : SIZES.find((s) => s.key === key);
}

/** 有効な色・大きさのキーか。保存データの検証に使う。 */
export function isColorKey(key: unknown): key is string {
  return typeof key === 'string' && PALETTE.some((p) => p.key === key);
}

export function isSizeKey(key: unknown): key is string {
  return typeof key === 'string' && SIZES.some((s) => s.key === key);
}

/**
 * 地点ごとの指定 → 全体の指定 → 既定 の順に採用して、実際に使う値を返す。
 */
export function resolveAppearance(
  own: MarkerStyle | undefined,
  global: MarkerStyle | undefined,
): ResolvedAppearance {
  const palette =
    findColor(own?.color) ??
    findColor(global?.color) ??
    (findColor(DEFAULT_COLOR_KEY) as PaletteEntry);
  const size =
    findSize(own?.size) ??
    findSize(global?.size) ??
    (findSize(DEFAULT_SIZE_KEY) as SizeEntry);
  return {
    colorKey: palette.key,
    color: palette.color,
    strong: palette.strong,
    sizeKey: size.key,
    scale: size.scale,
  };
}

/** 未知の値を落として MarkerStyle にする。空になるなら undefined。 */
export function normalizeStyle(u: unknown): MarkerStyle | undefined {
  if (typeof u !== 'object' || u === null) return undefined;
  const o = u as Record<string, unknown>;
  const style: MarkerStyle = {};
  if (isColorKey(o.color)) style.color = o.color;
  if (isSizeKey(o.size)) style.size = o.size;
  return style.color === undefined && style.size === undefined
    ? undefined
    : style;
}
