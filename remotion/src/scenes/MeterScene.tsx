import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_BODY, FONT_DISPLAY} from '../theme';
import {clamp} from '../timing';
import type {MeterProps} from '../types';
import {MainArea} from './common';

const W = 860;
const R = 350;
const CX = W / 2;
const CY = 400;
const H = 470;

const polar = (deg: number, r: number) => {
  const rad = (Math.PI * (180 - deg)) / 180;
  return [CX + r * Math.cos(rad), CY - r * Math.sin(rad)] as const;
};
const arc = (from: number, to: number, r: number) => {
  const [x1, y1] = polar(from, r);
  const [x2, y2] = polar(to, r);
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
};

/** やらかし度メーター：章ごとに針が上がる */
export const MeterScene: React.FC<{props: MeterProps}> = ({props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const from = props.from ?? 0;
  const s = spring({frame: frame - 8, fps, config: {damping: 7, mass: 0.9, stiffness: 90}});
  const value = from + (props.level - from) * s;
  const deg = (Math.max(0, Math.min(100, value)) / 100) * 180;
  const danger = props.level >= 85;
  const shake = danger && frame > 20 ? Math.sin(frame * 2.3) * interpolate(frame, [20, 60], [6, 1.5], clamp) : 0;
  const shown = Math.round(interpolate(frame, [8, 8 + fps], [from, props.level], {...clamp, easing: Easing.out(Easing.cubic)}));
  const zones = [
    {a: 0, b: 60, c: '#7FC77A'},
    {a: 60, b: 120, c: '#F2C14E'},
    {a: 120, b: 180, c: C.accent},
  ];
  return (
    <MainArea style={{display: 'flex', flexDirection: 'column', alignItems: 'center', translate: `${shake}px 0px`}}>
      <div style={{fontFamily: FONT_DISPLAY, fontSize: 60, color: C.ink}}>{props.label ?? 'やらかし度'}メーター</div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{marginTop: 4}}>
        {zones.map((z) => (
          <path key={z.a} d={arc(z.a, z.b, R)} stroke={z.c} strokeWidth={70} fill="none" />
        ))}
        {Array.from({length: 11}).map((_, i) => {
          const [x1, y1] = polar(i * 18, R - 46);
          const [x2, y2] = polar(i * 18, R - 70);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.ink} strokeWidth={i % 5 === 0 ? 8 : 4} strokeLinecap="round" />;
        })}
        <text x={polar(0, R)[0] + 4} y={CY + 52} fontFamily={FONT_BODY} fontWeight={800} fontSize={30} fill={C.inkSoft} textAnchor="middle">
          セーフ
        </text>
        <text x={polar(180, R)[0] - 4} y={CY + 52} fontFamily={FONT_BODY} fontWeight={800} fontSize={30} fill={C.accent} textAnchor="middle">
          アウト
        </text>
        <g style={{rotate: `${deg - 90}deg`, transformOrigin: `${CX}px ${CY}px`}}>
          <polygon points={`${CX - 18},${CY} ${CX},${CY - R + 36} ${CX + 18},${CY}`} fill={C.ink} />
        </g>
        <circle cx={CX} cy={CY} r={66} fill={danger ? C.accent : C.ink} stroke="#fff" strokeWidth={8} />
        <text x={CX} y={CY + 20} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={56} fill="#fff">
          {shown}
        </text>
      </svg>
      {props.caption ? (
        <div style={{marginTop: 4, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 40, color: C.ink, background: C.card, border: `3px solid ${C.ink}`, borderRadius: 999, padding: '6px 32px', opacity: interpolate(frame, [20, 30], [0, 1], clamp)}}>
          {props.caption}
        </div>
      ) : null}
    </MainArea>
  );
};
