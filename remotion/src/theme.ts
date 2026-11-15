// シリーズ共通の見た目（バラエティ番組風）。回ごとに変えない。
export const C = {
  stage: '#15131D', // 背景の暗色
  stageLine: 'rgba(255,255,255,0.045)',
  board: '#FFFBF0', // 中央のフリップ
  ink: '#1B1923',
  inkSoft: '#4A4658',
  muted: '#8A8598',
  footer: '#B9B4C7',
  yellow: '#FFE14D',
  red: '#E63946',
  redSoft: '#FFE1E1',
  green: '#1E9E6A',
  greenSoft: '#D7F5E7',
  blue: '#2F6FE0',
  gold: '#F5B700',
  zundamon: '#7CCB4E',
  zundamonDark: '#3E8E22',
  metan: '#E2559A',
  metanDark: '#A8286A',
} as const;

export const FONT_BODY = '"M PLUS Rounded 1c", sans-serif';
export const FONT_DISPLAY = '"Dela Gothic One", "M PLUS Rounded 1c", sans-serif';

/** 画面の領域（1920x1080 前提） */
export const LAYOUT = {
  boardLeft: 72,
  boardTop: 96,
  boardWidth: 1776,
  boardHeight: 664,
  mainLeft: 104,
  mainTop: 120,
  mainWidth: 1712,
  mainHeight: 616,
  bottomTop: 768,
  footerY: 1044,
} as const;

/** 億円単位の数を「1兆2,400億円」の形にする */
export function formatOku(n: number): string {
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(Math.round(n));
  if (a >= 10000) {
    const cho = Math.floor(a / 10000);
    const oku = a % 10000;
    return `${sign}${cho}兆${oku > 0 ? `${oku.toLocaleString('ja-JP')}億` : ''}円`;
  }
  return `${sign}${a.toLocaleString('ja-JP')}億円`;
}

export const formatNumber = (n: number) => (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('ja-JP');

/** 「{強調}」記法を区切る */
export function parseMarks(text: string): {t: string; em: boolean}[] {
  const out: {t: string; em: boolean}[] = [];
  const re = /\{([^}]*)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({t: text.slice(last, m.index), em: false});
    out.push({t: m[1], em: true});
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({t: text.slice(last), em: false});
  return out;
}

export const stripMarks = (text: string) => text.replace(/[{}]/g, '');

/** 色を少し暗く／明るくする（#RRGGBB） */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amount > 0 ? (255 - v) * amount : v * amount))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export const withAlpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
