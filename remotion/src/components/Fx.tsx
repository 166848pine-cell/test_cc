import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_DISPLAY} from '../theme';
import {clamp} from '../timing';

type Stroke = {w: number; color: string};

/**
 * 縁取り文字。strokes は外側から順に（太い順に）重ねる。
 * -webkit-text-stroke は線の中心が字の輪郭なので、外にはみ出す分の 2 倍の太さで描く。
 */
export const Outlined: React.FC<{
  children: React.ReactNode;
  strokes: Stroke[];
  fill?: string;
  style?: React.CSSProperties;
}> = ({children, strokes, fill = '#fff', style}) => (
  <span style={{position: 'relative', display: 'inline-block', ...style}}>
    {strokes.map((s, i) => (
      <span
        key={i}
        aria-hidden
        style={{position: 'absolute', inset: 0, color: s.color, WebkitTextStroke: `${s.w * 2}px ${s.color}`, whiteSpace: 'inherit'}}
      >
        {children}
      </span>
    ))}
    <span style={{position: 'relative', color: fill}}>{children}</span>
  </span>
);

/** 集中線（背景でゆっくり回る放射状の線） */
export const Burst: React.FC<{color: string; size?: number; rays?: number; opacity?: number}> = ({color, size = 1400, rays = 28, opacity = 0.22}) => {
  const frame = useCurrentFrame();
  const r = size / 2;
  const wedges = Array.from({length: rays}).map((_, i) => {
    const a0 = (i / rays) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / rays / 2;
    return `M ${r} ${r} L ${r + r * Math.cos(a0)} ${r + r * Math.sin(a0)} L ${r + r * Math.cos(a1)} ${r + r * Math.sin(a1)} Z`;
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{position: 'absolute', left: '50%', top: '50%', marginLeft: -r, marginTop: -r, rotate: `${frame * 0.25}deg`, opacity, pointerEvents: 'none'}}
    >
      {wedges.map((d, i) => (
        <path key={i} d={d} fill={color} />
      ))}
    </svg>
  );
};

/** ハンコ：start フレームでドンと押される */
export const Stamp: React.FC<{text: string; start: number; color?: string; style?: React.CSSProperties; size?: number}> = ({
  text,
  start,
  color = C.red,
  style,
  size = 76,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < start) return null;
  const t = frame - start;
  const scale = interpolate(t, [0, 5, 9], [2.4, 0.92, 1], {...clamp, easing: Easing.out(Easing.quad)});
  const ring = interpolate(t, [3, 3 + fps * 0.4], [0.6, 1.8], clamp);
  return (
    <div style={{position: 'absolute', ...style}}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 260,
          height: 260,
          marginLeft: -130,
          marginTop: -130,
          borderRadius: '50%',
          border: `8px solid ${color}`,
          scale: String(ring),
          opacity: interpolate(t, [3, 3 + fps * 0.4], [0.7, 0], clamp),
        }}
      />
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: size,
          lineHeight: 1,
          color,
          padding: '14px 26px 18px',
          border: `9px solid ${color}`,
          borderRadius: 18,
          background: 'rgba(255,255,255,0.88)',
          rotate: '-11deg',
          scale: String(scale),
          opacity: interpolate(t, [0, 3], [0, 1], clamp),
          whiteSpace: 'nowrap',
          boxShadow: `0 0 0 4px rgba(255,255,255,0.9)`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** 着地の揺れ（start から数フレーム） */
export const shakeAt = (frame: number, start: number, power = 10, len = 10) => {
  const t = frame - start;
  if (t < 0 || t > len) return 0;
  return Math.sin(t * 2.6) * power * (1 - t / len);
};
