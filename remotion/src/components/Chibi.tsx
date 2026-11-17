// ずんだもん・四国めたんの立ち絵（自作の二次創作。東北ずん子・ずんだもんプロジェクトのガイドラインに従う）。
// 部品（髪・目・口・眉など）を SVG で描き分け、口パク・まばたき・表情差分に対応する。
import type {Emotion, Speaker} from '../types';

export type Mouth = 0 | 1 | 2 | 3; // 0=閉じ 1=少し 2=開き 3=大きく

const LINE = '#4A3540';
const SKIN = '#FFF1E6';
const SKIN_SHADE = '#F7D9C8';

type Palette = {hair: string; hairShade: string; hairLight: string; iris: string; irisDark: string};
const PAL: Record<Speaker, Palette> = {
  zundamon: {hair: '#8EE04F', hairShade: '#5DB32C', hairLight: '#C8F58C', iris: '#F4B83A', irisDark: '#B8661A'},
  metan: {hair: '#F37AB6', hairShade: '#C9468D', hairLight: '#FFC0DE', iris: '#45A6E6', irisDark: '#1E5E9E'},
};

const Eye: React.FC<{x: number; y: number; p: Palette; emotion: Emotion; blink: boolean; id: string}> = ({x, y, p, emotion, blink, id}) => {
  if (emotion === 'happy') {
    return <path d={`M ${x - 28} ${y + 6} Q ${x} ${y - 22} ${x + 28} ${y + 6}`} stroke={LINE} strokeWidth={8} fill="none" strokeLinecap="round" />;
  }
  if (blink) {
    return <path d={`M ${x - 30} ${y + 2} Q ${x} ${y + 16} ${x + 30} ${y + 2}`} stroke={LINE} strokeWidth={7} fill="none" strokeLinecap="round" />;
  }
  const surprised = emotion === 'surprised';
  const sad = emotion === 'sad';
  const irisR = surprised ? 17 : 23;
  const iy = y + (sad ? 6 : 4);
  return (
    <g>
      <ellipse cx={x} cy={y} rx={29} ry={35} fill="#fff" />
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.irisDark} />
          <stop offset="0.55" stopColor={p.iris} />
          <stop offset="1" stopColor={p.iris} />
        </linearGradient>
      </defs>
      <ellipse cx={x} cy={iy} rx={irisR} ry={irisR * 1.25} fill={`url(#${id})`} />
      <ellipse cx={x} cy={iy + 2} rx={irisR * 0.45} ry={irisR * 0.62} fill="#2A1A22" />
      <circle cx={x - 8} cy={iy - 11} r={surprised ? 5 : 8} fill="#fff" />
      <circle cx={x + 9} cy={iy + 13} r={3.5} fill="#fff" opacity={0.9} />
      {/* 上まつげ */}
      <path d={`M ${x - 34} ${y - 20} Q ${x - 4} ${y - (sad ? 34 : 44)} ${x + 34} ${y - 24}`} stroke={LINE} strokeWidth={8} fill="none" strokeLinecap="round" />
      <path d={`M ${x + 30} ${y - 24} L ${x + 40} ${y - 30}`} stroke={LINE} strokeWidth={5} strokeLinecap="round" />
      {sad ? <path d={`M ${x - 30} ${y - 22} L ${x + 30} ${y - 26}`} stroke={LINE} strokeWidth={0} /> : null}
    </g>
  );
};

const MouthShape: React.FC<{emotion: Emotion; open: Mouth}> = ({emotion, open}) => {
  const x = 200;
  const y = 270;
  if (open === 0) {
    if (emotion === 'surprised') return <ellipse cx={x} cy={y + 2} rx={10} ry={12} fill="#9A3B47" stroke={LINE} strokeWidth={4} />;
    if (emotion === 'sad') return <path d={`M ${x - 16} ${y + 8} Q ${x} ${y - 6} ${x + 16} ${y + 8}`} stroke={LINE} strokeWidth={5} fill="none" strokeLinecap="round" />;
    if (emotion === 'happy') return <path d={`M ${x - 20} ${y - 4} Q ${x} ${y + 22} ${x + 20} ${y - 4} Z`} fill="#9A3B47" stroke={LINE} strokeWidth={4} strokeLinejoin="round" />;
    return <path d={`M ${x - 14} ${y - 2} Q ${x} ${y + 10} ${x + 14} ${y - 2}`} stroke={LINE} strokeWidth={5} fill="none" strokeLinecap="round" />;
  }
  const h = [0, 9, 16, 24][open];
  const w = emotion === 'surprised' ? 13 : [0, 14, 17, 20][open];
  return (
    <g>
      <path d={`M ${x - w} ${y - 4} Q ${x} ${y - 8} ${x + w} ${y - 4} Q ${x + w * 0.8} ${y + h} ${x} ${y + h + 2} Q ${x - w * 0.8} ${y + h} ${x - w} ${y - 4} Z`} fill="#9A3B47" stroke={LINE} strokeWidth={4} strokeLinejoin="round" />
      {open >= 2 ? <ellipse cx={x} cy={y + h * 0.65} rx={w * 0.5} ry={h * 0.28} fill="#E87A8C" /> : null}
    </g>
  );
};

const Face: React.FC<{speaker: Speaker; emotion: Emotion; mouth: Mouth; blink: boolean}> = ({speaker, emotion, mouth, blink}) => {
  const p = PAL[speaker];
  return (
    <g>
      <path d="M 92 182 Q 90 296 200 304 Q 310 296 308 182 Q 306 92 200 88 Q 94 92 92 182 Z" fill={SKIN} stroke={LINE} strokeWidth={4} />
      <path d="M 104 210 Q 120 250 150 262" stroke={SKIN_SHADE} strokeWidth={0} fill="none" />
      <ellipse cx={126} cy={252} rx={20} ry={10} fill="#FF9DB0" opacity={0.55} />
      <ellipse cx={274} cy={252} rx={20} ry={10} fill="#FF9DB0" opacity={0.55} />
      <Eye x={152} y={216} p={p} emotion={emotion} blink={blink} id={`${speaker}-iris-l`} />
      <Eye x={248} y={216} p={p} emotion={emotion} blink={blink} id={`${speaker}-iris-r`} />
      <MouthShape emotion={emotion} open={mouth} />
    </g>
  );
};

const Brows: React.FC<{emotion: Emotion; color: string}> = ({emotion, color}) => {
  if (emotion === 'sad') {
    return (
      <g opacity={0.85}>
        <path d="M 124 160 Q 150 150 172 168" stroke={color} strokeWidth={7} fill="none" strokeLinecap="round" />
        <path d="M 276 160 Q 250 150 228 168" stroke={color} strokeWidth={7} fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (emotion === 'surprised') {
    return (
      <g opacity={0.85}>
        <path d="M 126 150 Q 150 138 174 150" stroke={color} strokeWidth={7} fill="none" strokeLinecap="round" />
        <path d="M 226 150 Q 250 138 274 150" stroke={color} strokeWidth={7} fill="none" strokeLinecap="round" />
      </g>
    );
  }
  return null;
};

/** 枝豆のさや（ずんだもんの頭の飾り） */
const Pod: React.FC<{x: number; y: number; rot: number; flip?: boolean}> = ({x, y, rot, flip}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${flip ? -1 : 1} 1)`}>
    <path d="M 0 0 C 18 -16 70 -34 108 -22 C 124 -16 124 4 108 10 C 72 24 24 22 0 0 Z" fill="#9BE25A" stroke={LINE} strokeWidth={4} strokeLinejoin="round" />
    {[30, 58, 86].map((cx) => (
      <ellipse key={cx} cx={cx} cy={-6} rx={12} ry={10} fill="#D6F79E" stroke="#6BB536" strokeWidth={2.5} />
    ))}
  </g>
);

const ZundamonBody: React.FC = () => (
  <g>
    {/* ずんだアロー（後ろの緑のしずく） */}
    <path d="M 300 330 C 330 360 372 380 372 440 A 52 52 0 1 1 300 470 C 300 430 290 380 300 330 Z" fill="#8EE04F" stroke={LINE} strokeWidth={4} />
    <ellipse cx={330} cy={440} rx={14} ry={22} fill="#C8F58C" opacity={0.8} />
    <rect x={182} y={290} width={36} height={34} fill={SKIN_SHADE} />
    <path d="M 108 520 Q 110 372 152 336 L 248 336 Q 290 372 292 520 Z" fill="#fff" stroke={LINE} strokeWidth={4} />
    <circle cx={132} cy={358} r={30} fill="#fff" stroke={LINE} strokeWidth={4} />
    <circle cx={268} cy={358} r={30} fill="#fff" stroke={LINE} strokeWidth={4} />
    <path d="M 172 334 L 200 366 L 228 334" fill="#fff" stroke={LINE} strokeWidth={4} strokeLinejoin="round" />
    <path d="M 186 366 L 200 352 L 214 366 L 200 380 Z" fill="#F7A6C9" stroke={LINE} strokeWidth={3} />
    <path d="M 138 440 L 262 440 L 272 520 L 128 520 Z" fill="#6CBF3A" stroke={LINE} strokeWidth={4} strokeLinejoin="round" />
    <path d="M 160 338 L 164 444" stroke="#6CBF3A" strokeWidth={16} strokeLinecap="round" />
    <path d="M 240 338 L 236 444" stroke="#6CBF3A" strokeWidth={16} strokeLinecap="round" />
    <circle cx={164} cy={452} r={7} fill="#F9E26B" stroke={LINE} strokeWidth={2.5} />
    <circle cx={236} cy={452} r={7} fill="#F9E26B" stroke={LINE} strokeWidth={2.5} />
  </g>
);

const MetanBody: React.FC = () => (
  <g>
    <rect x={182} y={290} width={36} height={34} fill={SKIN_SHADE} />
    <path d="M 104 520 Q 108 372 152 338 L 248 338 Q 292 372 296 520 Z" fill="#2E2833" stroke={LINE} strokeWidth={4} />
    {/* フリルの襟 */}
    {[146, 168, 190, 210, 232, 254].map((cx, i) => (
      <circle key={cx} cx={cx} cy={346 + (i === 0 || i === 5 ? 6 : 0)} r={16} fill="#fff" stroke={LINE} strokeWidth={3} />
    ))}
    <path d="M 180 366 L 200 380 L 220 366 L 214 392 L 200 384 L 186 392 Z" fill="#E2558F" stroke={LINE} strokeWidth={3} strokeLinejoin="round" />
    <path d="M 200 392 L 200 520" stroke="#4A4252" strokeWidth={4} />
    {[420, 456, 492].map((cy) => (
      <circle key={cy} cx={200} cy={cy} r={6} fill="#D9C27A" stroke={LINE} strokeWidth={2} />
    ))}
  </g>
);

/** ドリルのツインテール（四国めたん） */
const Drill: React.FC<{x: number; dir: 1 | -1; p: Palette}> = ({x, dir, p}) => (
  <g>
    {[0, 1, 2, 3, 4].map((i) => {
      const cy = 214 + i * 50;
      const rx = 44 - i * 4;
      return (
        <g key={i}>
          <ellipse cx={x + dir * (i % 2 === 0 ? 0 : 10)} cy={cy} rx={rx} ry={30 - i} fill={p.hair} stroke={LINE} strokeWidth={4} />
          <path d={`M ${x - rx + 8} ${cy + 4} Q ${x} ${cy + 26} ${x + rx - 8} ${cy - 6}`} stroke={p.hairShade} strokeWidth={6} fill="none" strokeLinecap="round" />
          <path d={`M ${x - rx * 0.4} ${cy - 16} Q ${x} ${cy - 22} ${x + rx * 0.3} ${cy - 18}`} stroke={p.hairLight} strokeWidth={5} fill="none" strokeLinecap="round" />
        </g>
      );
    })}
  </g>
);

const Ribbon: React.FC<{x: number; y: number; rot: number}> = ({x, y, rot}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <path d="M 0 0 L -46 -24 L -40 22 Z" fill="#26222B" stroke={LINE} strokeWidth={3} strokeLinejoin="round" />
    <path d="M 0 0 L 46 -24 L 40 22 Z" fill="#26222B" stroke={LINE} strokeWidth={3} strokeLinejoin="round" />
    <path d="M 0 0 L -14 40 M 0 0 L 14 40" stroke="#26222B" strokeWidth={9} strokeLinecap="round" />
    <circle cx={0} cy={0} r={11} fill="#3A3540" stroke={LINE} strokeWidth={3} />
  </g>
);

export const ChibiFigure: React.FC<{speaker: Speaker; emotion: Emotion; mouth: Mouth; blink: boolean; width?: number}> = ({speaker, emotion, mouth, blink, width = 380}) => {
  const p = PAL[speaker];
  const z = speaker === 'zundamon';
  return (
    <svg width={width} height={(width * 520) / 400} viewBox="0 0 400 520" style={{overflow: 'visible'}}>
      {/* 後ろ髪 */}
      {z ? (
        <g>
          <path d="M 70 190 Q 64 60 200 50 Q 336 60 330 190 Q 332 270 300 300 L 100 300 Q 68 270 70 190 Z" fill={p.hairShade} stroke={LINE} strokeWidth={4} />
          <path d="M 300 240 Q 320 300 296 330 Q 286 300 284 260 Z" fill={p.hair} stroke={LINE} strokeWidth={4} />
          <path d="M 100 240 Q 80 300 104 330 Q 114 300 116 260 Z" fill={p.hair} stroke={LINE} strokeWidth={4} />
        </g>
      ) : (
        <g>
          <path d="M 76 190 Q 70 58 200 48 Q 330 58 324 190 L 330 360 L 70 360 Z" fill={p.hairShade} stroke={LINE} strokeWidth={4} />
          <Drill x={64} dir={-1} p={p} />
          <Drill x={336} dir={1} p={p} />
        </g>
      )}
      {z ? <ZundamonBody /> : <MetanBody />}
      <Face speaker={speaker} emotion={emotion} mouth={mouth} blink={blink} />
      {/* 前髪 */}
      {z ? (
        <g>
          <path
            d="M 78 206 Q 66 74 200 58 Q 334 74 322 206 L 302 168 L 286 204 L 266 146 L 244 194 L 222 136 L 202 188 L 180 136 L 160 194 L 138 146 L 116 204 L 98 166 Z"
            fill={p.hair}
            stroke={LINE}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <path d="M 130 92 Q 170 74 214 80" stroke={p.hairLight} strokeWidth={9} fill="none" strokeLinecap="round" />
          <path d="M 200 58 Q 214 30 236 26 Q 222 40 214 62" fill={p.hair} stroke={LINE} strokeWidth={4} strokeLinejoin="round" />
          <Pod x={148} y={74} rot={-118} />
          <Pod x={252} y={74} rot={-62} />
        </g>
      ) : (
        <g>
          <path
            d="M 80 214 Q 70 70 200 58 Q 330 70 320 214 L 312 178 Q 300 132 240 116 Q 262 146 264 172 Q 242 140 208 128 L 200 146 L 192 128 Q 158 140 136 172 Q 138 146 160 116 Q 100 132 88 178 Z"
            fill={p.hair}
            stroke={LINE}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <path d="M 120 98 Q 160 78 200 80" stroke={p.hairLight} strokeWidth={9} fill="none" strokeLinecap="round" />
          <Ribbon x={92} y={92} rot={-25} />
          <Ribbon x={308} y={92} rot={25} />
        </g>
      )}
      <Brows emotion={emotion} color={z ? '#3E8E22' : '#A23270'} />
    </svg>
  );
};
