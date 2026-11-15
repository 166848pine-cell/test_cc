import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Burst, Outlined, shakeAt} from '../components/Fx';
import {C, FONT_BODY, FONT_DISPLAY} from '../theme';
import {clamp, METER_BREAK_SEC} from '../timing';
import type {MeterProps, TimelineScene} from '../types';
import {MainArea} from './common';

const W = 900;
const R = 340;
const CX = W / 2;
const CY = 390;
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

/** やらかし度メーター。level が 100 を超えると振り切れて「測定不能」になる */
export const MeterScene: React.FC<{scene: TimelineScene; props: MeterProps}> = ({scene, props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const from = props.from ?? 0;
  const broken = props.level > 100;
  const s = spring({frame: frame - 8, fps, config: {damping: broken ? 5 : 8, mass: 0.9, stiffness: 90}});
  const value = from + (props.level - from) * s;
  // 振り切れたときは、針が右端を越えてガタガタ震える
  const jitter = broken && frame > 20 ? Math.sin(frame * 3.1) * 7 : 0;
  const deg = Math.max(-5, Math.min(broken ? 188 : 180, (value / 100) * 180)) + jitter;
  const danger = props.level >= 85;
  const breakAt = 8 + Math.round(METER_BREAK_SEC * fps);
  const shake = broken ? shakeAt(frame, breakAt, 18, 16) : danger ? shakeAt(frame, 20, 8, 10) : 0;
  const shown = broken && frame >= breakAt ? '???' : String(Math.round(interpolate(frame, [8, 8 + fps], [from, Math.min(props.level, 100)], {...clamp, easing: Easing.out(Easing.cubic)})));
  const zones = [
    {a: 0, b: 60, c: '#5CC8A0'},
    {a: 60, b: 120, c: C.yellow},
    {a: 120, b: 180, c: C.red},
  ];
  return (
    <MainArea shake={shake} style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      {broken && frame >= breakAt ? (
        <div style={{position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 30}}>
          <Burst color={C.red} size={2200} rays={32} opacity={interpolate(frame - breakAt, [0, 6], [0, 0.2], clamp)} />
        </div>
      ) : null}
      <Outlined strokes={[{w: 10, color: C.ink}]} fill={scene.accent} style={{fontFamily: FONT_DISPLAY, fontSize: 64, lineHeight: 1.1}}>
        {props.label ?? 'やらかし度'}メーター
      </Outlined>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{marginTop: 2, overflow: 'visible'}}>
        <path d={arc(0, 180, R)} stroke={C.ink} strokeWidth={96} fill="none" />
        {zones.map((z) => (
          <path key={z.a} d={arc(z.a, z.b, R)} stroke={z.c} strokeWidth={80} fill="none" />
        ))}
        {Array.from({length: 11}).map((_, i) => {
          const [x1, y1] = polar(i * 18, R - 56);
          const [x2, y2] = polar(i * 18, R - 82);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.ink} strokeWidth={i % 5 === 0 ? 10 : 5} strokeLinecap="round" />;
        })}
        <text x={polar(0, R)[0]} y={CY + 64} fontFamily={FONT_DISPLAY} fontSize={34} fill={C.ink} textAnchor="middle">
          セーフ
        </text>
        <text x={polar(180, R)[0]} y={CY + 64} fontFamily={FONT_DISPLAY} fontSize={34} fill={C.red} textAnchor="middle">
          アウト
        </text>
        <g style={{rotate: `${deg - 90}deg`, transformOrigin: `${CX}px ${CY}px`}}>
          <polygon points={`${CX - 22},${CY} ${CX},${CY - R + 30} ${CX + 22},${CY}`} fill={C.ink} />
        </g>
        <circle cx={CX} cy={CY} r={72} fill={danger ? C.red : C.ink} stroke="#fff" strokeWidth={10} />
        <text x={CX} y={CY + 22} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={shown.length > 2 ? 52 : 62} fill="#fff">
          {shown}
        </text>
      </svg>
      {broken && frame >= breakAt ? (
        <div
          style={{
            position: 'absolute',
            right: 120,
            top: 120,
            fontFamily: FONT_DISPLAY,
            fontSize: 84,
            color: C.red,
            border: `10px solid ${C.red}`,
            borderRadius: 18,
            padding: '8px 26px 14px',
            background: 'rgba(255,255,255,0.9)',
            rotate: '14deg',
            scale: String(interpolate(frame - breakAt, [0, 5, 9], [2.4, 0.9, 1], clamp)),
          }}
        >
          測定不能
        </div>
      ) : null}
      {props.caption ? (
        <div
          style={{
            marginTop: -6,
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 38,
            color: '#fff',
            background: C.ink,
            borderRadius: 999,
            padding: '6px 34px 8px',
            boxShadow: `6px 6px 0 ${scene.accent}`,
            opacity: interpolate(frame, [20, 30], [0, 1], clamp),
          }}
        >
          {props.caption}
        </div>
      ) : null}
    </MainArea>
  );
};
