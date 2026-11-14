import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_BODY, FONT_DISPLAY, formatOku} from '../theme';
import {clamp, enter, revealFrame} from '../timing';
import type {BigNumberProps, TimelineScene} from '../types';
import {MainArea} from './common';

/** 大きな金額をドンと出す。countToOku があれば「◯兆◯億円」でカウントアップ */
export const BigNumberScene: React.FC<{scene: TimelineScene; props: BigNumberProps}> = ({scene, props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const color = props.tone === 'minus' ? C.minus : props.tone === 'plus' ? C.plus : C.neutral;
  const soft = props.tone === 'minus' ? C.minusSoft : props.tone === 'plus' ? C.plusSoft : '#DDE6F6';
  const countEnd = Math.round(1.3 * fps);
  let shown = props.value;
  if (props.countToOku !== undefined && frame < countEnd) {
    const v = interpolate(frame, [4, countEnd], [0, props.countToOku], {...clamp, easing: Easing.out(Easing.cubic)});
    shown = `${props.value.startsWith('約') ? '約' : ''}${formatOku(Math.round(v))}`;
  }
  const landed = props.countToOku === undefined ? enter(frame, 2, fps, 10) : interpolate(frame, [countEnd, countEnd + 6], [1.08, 1], clamp);
  const valueLen = [...props.value].length;
  const valueSize = valueLen > 12 ? 120 : valueLen > 8 ? 150 : 180;
  const conv = props.conversion;
  const convStart = conv ? revealFrame(scene, conv.atLine, 0, 1) : 0;
  const cs = conv ? enter(frame, convStart, fps, 12) : 0;
  return (
    <MainArea style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      {props.heading ? (
        <div style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 46, color: C.ink, background: C.card, border: `3px solid ${C.ink}`, borderRadius: 999, padding: '8px 36px', marginTop: 6}}>
          {props.heading}
        </div>
      ) : null}
      <div
        style={{
          marginTop: conv ? 26 : 60,
          fontFamily: FONT_DISPLAY,
          fontSize: valueSize,
          lineHeight: 1.1,
          color,
          whiteSpace: 'nowrap',
          scale: String(props.countToOku === undefined ? interpolate(landed, [0, 1], [0.5, 1]) : landed),
          opacity: props.countToOku === undefined ? landed : 1,
          textShadow: `0 8px 0 ${soft}`,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {shown}
      </div>
      {props.caption ? (
        <div style={{marginTop: 18, maxWidth: 1500, textAlign: 'center', fontFamily: FONT_BODY, fontWeight: 800, fontSize: 36, lineHeight: 1.35, color: C.inkSoft, opacity: interpolate(frame, [countEnd - 6, countEnd + 6], [0, 1], clamp)}}>
          {props.caption}
        </div>
      ) : null}
      {conv && frame >= convStart ? (
        <div
          style={{
            marginTop: 26,
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            background: '#FFF3C4',
            border: `4px solid ${C.gold}`,
            borderRadius: 24,
            padding: '14px 36px',
            rotate: '-1.5deg',
            scale: String(interpolate(cs, [0, 1], [0.6, 1])),
            opacity: cs,
          }}
        >
          <div style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 34, color: C.inkSoft}}>{conv.label}</div>
          <div style={{fontFamily: FONT_DISPLAY, fontSize: 66, color: C.ink}}>{conv.value}</div>
          {conv.note ? <div style={{fontFamily: FONT_BODY, fontWeight: 500, fontSize: 24, color: C.muted, maxWidth: 300, lineHeight: 1.3}}>{conv.note}</div> : null}
        </div>
      ) : null}
    </MainArea>
  );
};
