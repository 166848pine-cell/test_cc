// シリーズ共通の見た目。回ごとに変えない。
export const C = {
  bg: '#FFF7E8',
  bgGrid: 'rgba(43, 42, 51, 0.045)',
  ink: '#2B2A33',
  inkSoft: '#5E5B6B',
  muted: '#8C8899',
  card: '#FFFFFF',
  line: '#E6DDCB',
  accent: '#E2463B', // やらかし（赤）
  accentSoft: '#FBE1DE',
  plus: '#1F7A55', // 黒字
  plusSoft: '#D9F0E5',
  minus: '#D23B33', // 赤字
  minusSoft: '#F9DAD7',
  neutral: '#2F5DA8',
  gold: '#E8A317',
  zundamon: '#5DAE45',
  zundamonDark: '#3E7F2C',
  metan: '#C2508A',
  metanDark: '#933766',
} as const;

export const FONT_BODY = '"M PLUS Rounded 1c", sans-serif';
export const FONT_DISPLAY = '"Dela Gothic One", "M PLUS Rounded 1c", sans-serif';

/** 画面の領域（1920x1080 前提） */
export const LAYOUT = {
  mainTop: 104,
  mainHeight: 630,
  sideMargin: 96,
  bottomTop: 760,
  footerY: 1036,
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
