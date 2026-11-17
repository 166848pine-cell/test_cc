// ずんだもん・四国めたんの立ち絵（自作の二次創作。東北ずん子・ずんだもんプロジェクトのガイドラインに従う）。
// 部品（髪・目・口・眉など）を SVG で描き分け、口パク・まばたき・表情差分に対応する。
// セル塗り風の影・グラデーション・ハイライトで立体感を出している。
import type {Emotion, Speaker} from '../types';

export type Mouth = 0 | 1 | 2 | 3; // 0=閉じ 1=少し 2=開き 3=大きく

type Palette = {
  hairTop: string;
  hairBottom: string;
  hairShade: string;
  hairLight: string;
  hairLine: string;
  irisTop: string;
  iris: string;
  irisLight: string;
  skinLine: string;
};
const PAL: Record<Speaker, Palette> = {
  zundamon: {
    hairTop: '#B4F06E',
    hairBottom: '#6FCB38',
    hairShade: '#4FA826',
    hairLight: '#E9FFC4',
    hairLine: '#2F7419',
    irisTop: '#A8521A',
    iris: '#F2A62E',
    irisLight: '#FFE07A',
    skinLine: '#8C5A4A',
  },
  metan: {
    hairTop: '#FFB1D6',
    hairBottom: '#EE6AA9',
    hairShade: '#C7427F',
    hairLight: '#FFE3F1',
    hairLine: '#8E2858',
    irisTop: '#1C4E93',
    iris: '#3E9BE4',
    irisLight: '#A6E2FF',
    skinLine: '#8C5A4A',
  },
};

const SKIN_LIGHT = '#FFF7F0';
const SKIN = '#FFE9DC';
const SKIN_SHADOW = '#F4C9B6';

const FACE = 'M 98 196 C 98 124 142 90 200 90 C 258 90 302 124 302 196 C 302 254 268 300 200 308 C 132 300 98 254 98 196 Z';

const Defs: React.FC<{s: Speaker; p: Palette}> = ({s, p}) => (
  <defs>
    <linearGradient id={`${s}-hair`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={p.hairTop} />
      <stop offset="1" stopColor={p.hairBottom} />
    </linearGradient>
    <linearGradient id={`${s}-hairBack`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={p.hairBottom} />
      <stop offset="1" stopColor={p.hairShade} />
    </linearGradient>
    <radialGradient id={`${s}-skin`} cx="0.5" cy="0.45" r="0.6">
      <stop offset="0.55" stopColor={SKIN_LIGHT} />
      <stop offset="1" stopColor={SKIN} />
    </radialGradient>
    <linearGradient id={`${s}-iris`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={p.irisTop} />
      <stop offset="0.45" stopColor={p.iris} />
      <stop offset="1" stopColor={p.irisLight} />
    </linearGradient>
    <radialGradient id={`${s}-blush`} cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor="#FF8FA8" stopOpacity="0.75" />
      <stop offset="1" stopColor="#FF8FA8" stopOpacity="0" />
    </radialGradient>
    <clipPath id={`${s}-face`}>
      <path d={FACE} />
    </clipPath>
  </defs>
);

const Eye: React.FC<{s: Speaker; x: number; y: number; p: Palette; emotion: Emotion; blink: boolean; right?: boolean}> = ({s, x, y, p, emotion, blink, right}) => {
  const dir = right ? 1 : -1; // 目尻の向き
  if (emotion === 'happy') {
    return <path d={`M ${x - 28} ${y + 8} Q ${x} ${y - 22} ${x + 28} ${y + 8}`} stroke={p.skinLine} strokeWidth={7} fill="none" strokeLinecap="round" />;
  }
  if (blink) {
    return (
      <g>
        <path d={`M ${x - 32} ${y + 2} Q ${x} ${y + 18} ${x + 32} ${y + 2}`} stroke="#3B2630" strokeWidth={6.5} fill="none" strokeLinecap="round" />
        <path d={`M ${x + dir * 30} ${y + 2} L ${x + dir * 40} ${y - 4}`} stroke="#3B2630" strokeWidth={4} strokeLinecap="round" />
      </g>
    );
  }
  const surprised = emotion === 'surprised';
  const sad = emotion === 'sad';
  const irx = surprised ? 18 : 25;
  const iry = surprised ? 22 : 31;
  const iy = y + (sad ? 8 : 5);
  const clip = `${s}-eye-${right ? 'r' : 'l'}`;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <ellipse cx={x} cy={y} rx={31} ry={37} />
        </clipPath>
      </defs>
      <ellipse cx={x} cy={y} rx={31} ry={37} fill="#fff" />
      <g clipPath={`url(#${clip})`}>
        {/* 白目の上の影 */}
        <ellipse cx={x} cy={y - 30} rx={36} ry={16} fill="#DCD6EC" />
        <ellipse cx={x} cy={iy} rx={irx} ry={iry} fill={`url(#${s}-iris)`} stroke={p.irisTop} strokeWidth={2.5} />
        <ellipse cx={x} cy={iy + 3} rx={irx * 0.44} ry={iry * 0.5} fill="#24121C" opacity={0.9} />
        {/* 瞳の下の照り返し */}
        <ellipse cx={x} cy={iy + iry * 0.55} rx={irx * 0.7} ry={iry * 0.28} fill={p.irisLight} opacity={0.75} />
        {/* ハイライト */}
        <ellipse cx={x - irx * 0.38} cy={iy - iry * 0.38} rx={surprised ? 5 : 9} ry={surprised ? 6 : 11} fill="#fff" />
        <circle cx={x + irx * 0.45} cy={iy + iry * 0.42} r={3.6} fill="#fff" />
        <circle cx={x + irx * 0.2} cy={iy - iry * 0.55} r={2.4} fill="#fff" opacity={0.9} />
      </g>
      {/* 上まつげ（目尻を太く） */}
      <path
        d={`M ${x - dir * 34} ${y - 18} Q ${x - dir * 8} ${y - (sad ? 32 : 44)} ${x + dir * 36} ${y - 22} L ${x + dir * 44} ${y - 28} L ${x + dir * 36} ${y - 14} Q ${x - dir * 6} ${y - (sad ? 26 : 36)} ${x - dir * 34} ${y - 12} Z`}
        fill="#3B2630"
      />
      {/* 二重のライン */}
      <path d={`M ${x - dir * 26} ${y - 42} Q ${x} ${y - 52} ${x + dir * 28} ${y - 40}`} stroke={p.skinLine} strokeWidth={2.2} fill="none" opacity={0.6} strokeLinecap="round" />
      {/* 下まつげ */}
      <path d={`M ${x + dir * 18} ${y + 34} Q ${x + dir * 26} ${y + 28} ${x + dir * 30} ${y + 20}`} stroke={p.skinLine} strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.7} />
    </g>
  );
};

const MouthShape: React.FC<{emotion: Emotion; open: Mouth; line: string}> = ({emotion, open, line}) => {
  const x = 200;
  const y = 276;
  if (open === 0) {
    if (emotion === 'surprised') return <ellipse cx={x} cy={y + 2} rx={8} ry={10} fill="#B5414F" stroke={line} strokeWidth={3} />;
    if (emotion === 'sad') return <path d={`M ${x - 12} ${y + 6} Q ${x} ${y - 4} ${x + 12} ${y + 6}`} stroke={line} strokeWidth={4} fill="none" strokeLinecap="round" />;
    if (emotion === 'happy') {
      return (
        <g>
          <path d={`M ${x - 17} ${y - 4} Q ${x} ${y + 20} ${x + 17} ${y - 4} Z`} fill="#B5414F" stroke={line} strokeWidth={3} strokeLinejoin="round" />
          <path d={`M ${x - 9} ${y + 7} Q ${x} ${y + 3} ${x + 9} ${y + 7} Q ${x} ${y + 14} ${x - 9} ${y + 7} Z`} fill="#F08A9A" />
        </g>
      );
    }
    // ふだんの口：小さな「ω」寄りの笑み
    return <path d={`M ${x - 12} ${y - 2} Q ${x - 6} ${y + 6} ${x} ${y} Q ${x + 6} ${y + 6} ${x + 12} ${y - 2}`} stroke={line} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  }
  const h = [0, 8, 14, 20][open];
  const w = emotion === 'surprised' ? 11 : [0, 11, 14, 16][open];
  return (
    <g>
      <path
        d={`M ${x - w} ${y - 3} Q ${x} ${y - 7} ${x + w} ${y - 3} Q ${x + w * 0.85} ${y + h} ${x} ${y + h + 2} Q ${x - w * 0.85} ${y + h} ${x - w} ${y - 3} Z`}
        fill="#B5414F"
        stroke={line}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {open >= 2 ? <ellipse cx={x} cy={y + h * 0.7} rx={w * 0.55} ry={h * 0.3} fill="#F08A9A" /> : null}
    </g>
  );
};

const Brows: React.FC<{emotion: Emotion; color: string}> = ({emotion, color}) => {
  if (emotion === 'sad') {
    return (
      <g opacity={0.8}>
        <path d="M 124 166 Q 150 154 172 170" stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" />
        <path d="M 276 166 Q 250 154 228 170" stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (emotion === 'surprised') {
    return (
      <g opacity={0.8}>
        <path d="M 126 154 Q 150 142 174 154" stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" />
        <path d="M 226 154 Q 250 142 274 154" stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" />
      </g>
    );
  }
  return null;
};

const Face: React.FC<{s: Speaker; p: Palette; emotion: Emotion; mouth: Mouth; blink: boolean; bangsShadow: string}> = ({s, p, emotion, mouth, blink, bangsShadow}) => (
  <g>
    <path d={FACE} fill={`url(#${s}-skin)`} stroke={p.skinLine} strokeWidth={3.5} />
    {/* 前髪の落ち影 */}
    <g clipPath={`url(#${s}-face)`}>
      <path d={bangsShadow} fill={SKIN_SHADOW} opacity={0.85} />
    </g>
    <ellipse cx={128} cy={258} rx={26} ry={14} fill={`url(#${s}-blush)`} />
    <ellipse cx={272} cy={258} rx={26} ry={14} fill={`url(#${s}-blush)`} />
    {[118, 128, 138].map((bx) => (
      <path key={bx} d={`M ${bx} 252 l -5 9`} stroke="#F07890" strokeWidth={2} strokeLinecap="round" opacity={0.6} />
    ))}
    {[262, 272, 282].map((bx) => (
      <path key={bx} d={`M ${bx} 252 l -5 9`} stroke="#F07890" strokeWidth={2} strokeLinecap="round" opacity={0.6} />
    ))}
    <Eye s={s} x={150} y={222} p={p} emotion={emotion} blink={blink} />
    <Eye s={s} x={250} y={222} p={p} emotion={emotion} blink={blink} right />
    <MouthShape emotion={emotion} open={mouth} line={p.skinLine} />
  </g>
);

/** 枝豆のさや（ずんだもんの頭の飾り） */
const Pod: React.FC<{x: number; y: number; rot: number}> = ({x, y, rot}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <path d="M 0 0 C 16 -18 70 -34 110 -20 C 128 -13 126 6 110 12 C 72 26 22 22 0 0 Z" fill="#A8E86A" stroke="#2F7419" strokeWidth={3.5} strokeLinejoin="round" />
    <path d="M 10 4 C 40 16 80 16 108 6" stroke="#6CBF35" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.8} />
    {[32, 60, 88].map((cx) => (
      <g key={cx}>
        <ellipse cx={cx} cy={-5} rx={13} ry={11} fill="#DDF8A8" stroke="#6CBF35" strokeWidth={2.5} />
        <ellipse cx={cx - 4} cy={-9} rx={4} ry={3} fill="#fff" opacity={0.8} />
      </g>
    ))}
  </g>
);

const ZundamonBody: React.FC = () => (
  <g>
    <defs>
      <linearGradient id="zunda-arrow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#B9F27A" />
        <stop offset="1" stopColor="#5FBF2E" />
      </linearGradient>
    </defs>
    {/* ずんだアロー（後ろの緑のしずく） */}
    <path d="M 296 330 C 330 362 374 384 372 442 A 52 52 0 1 1 298 468 C 298 428 286 380 296 330 Z" fill="url(#zunda-arrow)" stroke="#2F7419" strokeWidth={3.5} />
    <ellipse cx={334} cy={430} rx={12} ry={20} fill="#fff" opacity={0.55} />
    <path d="M 184 292 L 216 292 L 216 330 L 184 330 Z" fill={SKIN} />
    <path d="M 184 300 Q 200 318 216 300 L 216 312 Q 200 326 184 312 Z" fill={SKIN_SHADOW} />
    <path d="M 114 520 Q 116 376 156 340 L 244 340 Q 284 376 286 520 Z" fill="#FFFFFF" stroke="#8C7A86" strokeWidth={3.5} />
    <path d="M 156 340 Q 200 360 244 340 L 236 360 Q 200 372 164 360 Z" fill="#E7E3F0" />
    <circle cx={136} cy={362} r={28} fill="#fff" stroke="#8C7A86" strokeWidth={3.5} />
    <circle cx={264} cy={362} r={28} fill="#fff" stroke="#8C7A86" strokeWidth={3.5} />
    <path d="M 120 378 Q 136 390 152 378" stroke="#E2DDEB" strokeWidth={6} fill="none" strokeLinecap="round" />
    <path d="M 248 378 Q 264 390 280 378" stroke="#E2DDEB" strokeWidth={6} fill="none" strokeLinecap="round" />
    <path d="M 176 338 L 200 368 L 224 338" fill="#fff" stroke="#8C7A86" strokeWidth={3} strokeLinejoin="round" />
    <path d="M 188 370 L 200 358 L 212 370 L 200 384 Z" fill="#FFB3D1" stroke="#B0597F" strokeWidth={2.5} />
    <path d="M 142 444 L 258 444 L 268 520 L 132 520 Z" fill="#6DC23B" stroke="#2F7419" strokeWidth={3.5} strokeLinejoin="round" />
    <path d="M 146 456 L 254 456" stroke="#55A62A" strokeWidth={6} />
    <path d="M 162 342 L 166 448" stroke="#6DC23B" strokeWidth={15} strokeLinecap="round" />
    <path d="M 238 342 L 234 448" stroke="#6DC23B" strokeWidth={15} strokeLinecap="round" />
    <circle cx={166} cy={454} r={6.5} fill="#FFE27A" stroke="#2F7419" strokeWidth={2} />
    <circle cx={234} cy={454} r={6.5} fill="#FFE27A" stroke="#2F7419" strokeWidth={2} />
  </g>
);

const MetanBody: React.FC = () => (
  <g>
    <path d="M 184 292 L 216 292 L 216 332 L 184 332 Z" fill={SKIN} />
    <path d="M 184 300 Q 200 318 216 300 L 216 312 Q 200 326 184 312 Z" fill={SKIN_SHADOW} />
    <path d="M 110 520 Q 112 376 156 342 L 244 342 Q 288 376 290 520 Z" fill="#2F2934" stroke="#1C1820" strokeWidth={3.5} />
    <path d="M 128 520 Q 132 420 156 380" stroke="#4A4252" strokeWidth={8} fill="none" opacity={0.7} strokeLinecap="round" />
    {/* フリルの襟 */}
    {[150, 170, 190, 210, 230, 250].map((cx, i) => (
      <ellipse key={cx} cx={cx} cy={350 + (i === 0 || i === 5 ? 5 : 0)} rx={15} ry={13} fill="#fff" stroke="#9A8FA3" strokeWidth={2.5} />
    ))}
    <path d="M 182 370 L 200 384 L 218 370 L 213 396 L 200 388 L 187 396 Z" fill="#E2558F" stroke="#8E2858" strokeWidth={2.5} strokeLinejoin="round" />
    <path d="M 200 398 L 200 520" stroke="#4A4252" strokeWidth={3.5} />
    {[424, 458, 492].map((cy) => (
      <circle key={cy} cx={200} cy={cy} r={5.5} fill="#E0C985" stroke="#6E5A2E" strokeWidth={1.5} />
    ))}
  </g>
);

/** ドリルのツインテール（四国めたん）。上から細くなる巻き髪 */
const Drill: React.FC<{x: number; p: Palette; s: Speaker}> = ({x, p, s}) => (
  <g>
    {[0, 1, 2, 3, 4].map((i) => {
      const cy = 216 + i * 48;
      const rx = 42 - i * 5;
      const ry = 28 - i * 1.5;
      return (
        <g key={i}>
          <ellipse cx={x} cy={cy} rx={rx} ry={ry} fill={`url(#${s}-hair)`} stroke={p.hairLine} strokeWidth={3.5} />
          <path d={`M ${x - rx + 6} ${cy + 6} Q ${x} ${cy + ry + 4} ${x + rx - 6} ${cy - 4}`} stroke={p.hairShade} strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.85} />
          <path d={`M ${x - rx * 0.5} ${cy - ry * 0.55} Q ${x} ${cy - ry * 0.85} ${x + rx * 0.35} ${cy - ry * 0.6}`} stroke={p.hairLight} strokeWidth={5} fill="none" strokeLinecap="round" />
        </g>
      );
    })}
  </g>
);

const Ribbon: React.FC<{x: number; y: number; rot: number}> = ({x, y, rot}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <path d="M 0 0 Q -30 -34 -50 -20 Q -56 4 -40 20 Q -20 14 0 0 Z" fill="#2B2630" stroke="#141117" strokeWidth={3} strokeLinejoin="round" />
    <path d="M 0 0 Q 30 -34 50 -20 Q 56 4 40 20 Q 20 14 0 0 Z" fill="#2B2630" stroke="#141117" strokeWidth={3} strokeLinejoin="round" />
    <path d="M -36 -14 Q -24 -18 -14 -8" stroke="#5A5263" strokeWidth={4} fill="none" strokeLinecap="round" />
    <path d="M 36 -14 Q 24 -18 14 -8" stroke="#5A5263" strokeWidth={4} fill="none" strokeLinecap="round" />
    <path d="M -4 6 Q -14 26 -18 42 M 4 6 Q 14 26 18 42" stroke="#2B2630" strokeWidth={8} strokeLinecap="round" fill="none" />
    <ellipse cx={0} cy={0} rx={10} ry={9} fill="#3A3442" stroke="#141117" strokeWidth={3} />
  </g>
);

// 前髪の形（落ち影は同じ形を少し下にずらして使う）
const ZUNDA_BANGS =
  'M 80 210 Q 70 76 200 60 Q 330 76 320 210 Q 312 186 300 172 Q 296 196 286 208 Q 280 168 266 150 Q 260 182 244 198 Q 240 156 222 138 Q 214 172 200 190 Q 186 172 178 138 Q 160 156 156 198 Q 140 182 134 150 Q 120 168 114 208 Q 104 196 100 172 Q 88 186 80 210 Z';
const METAN_BANGS =
  'M 82 216 Q 72 72 200 58 Q 328 72 318 216 Q 312 188 304 170 Q 292 134 244 116 Q 262 148 262 176 Q 242 144 210 130 L 200 148 L 190 130 Q 158 144 138 176 Q 138 148 156 116 Q 108 134 96 170 Q 88 188 82 216 Z';
const shift = (d: string, dy: number) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, a, b) => `${a} ${Number(b) + dy}`);

export const ChibiFigure: React.FC<{speaker: Speaker; emotion: Emotion; mouth: Mouth; blink: boolean; width?: number}> = ({speaker, emotion, mouth, blink, width = 380}) => {
  const p = PAL[speaker];
  const s = speaker;
  const z = speaker === 'zundamon';
  const bangs = z ? ZUNDA_BANGS : METAN_BANGS;
  return (
    <svg width={width} height={(width * 520) / 400} viewBox="0 0 400 520" style={{overflow: 'visible'}}>
      <Defs s={s} p={p} />
      {/* 後ろ髪 */}
      {z ? (
        <g>
          <path d="M 72 196 Q 64 60 200 50 Q 336 60 328 196 Q 330 272 300 304 L 100 304 Q 70 272 72 196 Z" fill={`url(#${s}-hairBack)`} stroke={p.hairLine} strokeWidth={3.5} />
          <path d="M 302 228 Q 326 298 298 340 Q 284 304 282 258 Z" fill={`url(#${s}-hair)`} stroke={p.hairLine} strokeWidth={3.5} />
          <path d="M 98 228 Q 74 298 102 340 Q 116 304 118 258 Z" fill={`url(#${s}-hair)`} stroke={p.hairLine} strokeWidth={3.5} />
        </g>
      ) : (
        <g>
          <path d="M 78 196 Q 70 56 200 46 Q 330 56 322 196 L 326 360 L 74 360 Z" fill={`url(#${s}-hairBack)`} stroke={p.hairLine} strokeWidth={3.5} />
          <Drill x={66} p={p} s={s} />
          <Drill x={334} p={p} s={s} />
        </g>
      )}
      {z ? <ZundamonBody /> : <MetanBody />}
      <Face s={s} p={p} emotion={emotion} mouth={mouth} blink={blink} bangsShadow={shift(bangs, 14)} />
      {/* 前髪 */}
      <path d={bangs} fill={`url(#${s}-hair)`} stroke={p.hairLine} strokeWidth={3.5} strokeLinejoin="round" />
      {/* 髪の影の筋 */}
      <path d={z ? 'M 120 120 Q 130 150 134 150 M 178 104 Q 180 128 178 138 M 222 104 Q 220 128 222 138 M 280 120 Q 270 150 266 150' : 'M 130 112 Q 142 130 156 116 M 270 112 Q 258 130 244 116'} stroke={p.hairShade} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.7} />
      {/* 天使の輪（ツヤ） */}
      <path d="M 112 112 Q 150 84 200 82 Q 250 84 288 112" stroke={p.hairLight} strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.85} />
      <path d="M 140 100 Q 150 94 160 92 M 240 92 Q 250 94 260 100" stroke="#fff" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.9} />
      {z ? (
        <g>
          <path d="M 196 60 Q 206 28 236 22 Q 220 38 214 64" fill={`url(#${s}-hair)`} stroke={p.hairLine} strokeWidth={3.5} strokeLinejoin="round" />
          <Pod x={146} y={76} rot={-118} />
          <Pod x={254} y={76} rot={-62} />
        </g>
      ) : (
        <g>
          <Ribbon x={94} y={96} rot={-22} />
          <Ribbon x={306} y={96} rot={22} />
        </g>
      )}
      <Brows emotion={emotion} color={p.hairLine} />
    </svg>
  );
};
