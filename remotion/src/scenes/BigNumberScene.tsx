import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Burst, Outlined, shakeAt} from '../components/Fx';
import {C, FONT_BODY, FONT_DISPLAY, formatOku} from '../theme';
import {clamp, COUNT_END_SEC, enter, revealFrame} from '../timing';
import type {BigNumberProps, TimelineScene} from '../types';
import {MainArea} from './common';

/** 大きな金額をドンと出す。countToOku があれば「◯兆◯億円」でカウントアップして着地で揺れる */
export const BigNumberScene: React.FC<{scene: TimelineScene; props: BigNumberProps}> = ({scene, props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const fill = props.tone === 'minus' ? C.red : props.tone === 'plus' ? C.yellow : '#fff';
  const inner = props.tone === 'minus' ? '#7A0E16' : props.tone === 'plus' ? '#B5651D' : C.blue;
  const countEnd = Math.round(COUNT_END_SEC * fps);
  let shown = props.value;
  if (props.countToOku !== undefined && frame < countEnd) {
    const v = interpolate(frame, [4, countEnd], [0, props.countToOku], {...clamp, easing: Easing.out(Easing.cubic)});
    shown = `${props.value.startsWith('約') ? '約' : ''}${formatOku(Math.round(v))}`;
  }
  const landed = props.countToOku === undefined ? enter(frame, 3, fps, 9) : 1;
  const landScale = props.countToOku === undefined ? interpolate(landed, [0, 1], [2.4, 1]) : interpolate(frame, [countEnd, countEnd + 4, countEnd + 9], [1, 1.14, 1], clamp);
  const shake = shakeAt(frame, props.countToOku === undefined ? 6 : countEnd, 14, 12);
  const valueLen = [...props.value].length;
  const valueSize = valueLen > 12 ? 118 : valueLen > 8 ? 150 : 190;
  const conv = props.conversion;
  const convStart = conv ? revealFrame(scene, conv.atLine, 0, 1) : 0;
  const cs = conv ? enter(frame, convStart, fps, 10) : 0;
  return (
    <MainArea shake={shake} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'visible'}}>
      <div
        style={{
          position: 'absolute',
          left: -28,
          right: -28,
          top: -20,
          bottom: -20,
          overflow: 'hidden',
          borderRadius: 20,
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 42%, #000 0%, #000 35%, transparent 75%)',
        }}
      >
        <Burst color={props.tone === 'minus' ? C.red : scene.accent} size={2200} rays={30} opacity={0.24} />
      </div>
      {props.heading ? (
        <div
          style={{
            position: 'relative',
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 42,
            color: '#fff',
            background: C.ink,
            borderRadius: 999,
            padding: '8px 36px 10px',
            boxShadow: `6px 6px 0 ${scene.accent}`,
          }}
        >
          {props.heading}
        </div>
      ) : null}
      <div style={{position: 'relative', marginTop: conv ? 28 : 64, scale: String(landScale), opacity: Math.min(1, landed * 2), rotate: '-2deg'}}>
        <Outlined
          fill={fill}
          strokes={[
            {w: 18, color: C.ink},
            {w: 9, color: inner},
          ]}
          style={{fontFamily: FONT_DISPLAY, fontSize: valueSize, lineHeight: 1.1, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'}}
        >
          {shown}
        </Outlined>
      </div>
      {props.caption ? (
        <div
          style={{
            position: 'relative',
            marginTop: 20,
            maxWidth: 1640,
            textAlign: 'center',
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 32,
            lineHeight: 1.35,
            color: C.inkSoft,
            background: 'rgba(255,251,240,0.9)',
            padding: '2px 16px',
            borderRadius: 10,
            opacity: interpolate(frame, [countEnd - 4, countEnd + 6], [0, 1], clamp),
          }}
        >
          {props.caption}
        </div>
      ) : null}
      {conv && frame >= convStart ? (
        <div
          style={{
            position: 'relative',
            marginTop: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 26,
            background: C.yellow,
            border: `6px solid ${C.ink}`,
            borderRadius: 22,
            padding: '10px 34px 12px',
            boxShadow: `8px 8px 0 ${C.ink}`,
            rotate: '2deg',
            scale: String(interpolate(cs, [0, 1], [0.3, 1])),
            opacity: Math.min(1, cs * 2),
          }}
        >
          <div style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 30, color: C.ink, lineHeight: 1.2}}>{conv.label}</div>
          <div style={{fontFamily: FONT_DISPLAY, fontSize: 64, color: C.red, WebkitTextStroke: `2px ${C.ink}`}}>{conv.value}</div>
          {conv.note ? <div style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 22, color: C.inkSoft, maxWidth: 230, lineHeight: 1.3}}>{conv.note}</div> : null}
        </div>
      ) : null}
    </MainArea>
  );
};
