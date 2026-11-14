import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_BODY, FONT_DISPLAY} from '../theme';
import {clamp} from '../timing';
import type {QuoteProps} from '../types';
import {MainArea} from './common';

/** 報告書などからの短い引用（出典表示つき）。文字が順に打たれる */
export const QuoteScene: React.FC<{props: QuoteProps}> = ({props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const chars = [...props.text];
  const typed = Math.round(interpolate(frame, [6, 6 + Math.min(1.6 * fps, chars.length * 2.2)], [0, chars.length], clamp));
  const len = chars.length;
  const size = len <= 8 ? 150 : len <= 18 ? 84 : 66;
  return (
    <MainArea style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          position: 'relative',
          width: 1540,
          boxSizing: 'border-box',
          padding: '70px 90px 50px',
          background: C.card,
          borderRadius: 34,
          border: `4px solid ${C.ink}`,
          boxShadow: '0 14px 0 rgba(43,42,51,0.14)',
          scale: String(interpolate(frame, [0, 8], [0.94, 1], clamp)),
        }}
      >
        <div style={{position: 'absolute', left: 34, top: -40, fontFamily: FONT_DISPLAY, fontSize: 170, lineHeight: 1, color: C.accent}}>“</div>
        <div style={{fontFamily: len <= 8 ? FONT_DISPLAY : FONT_BODY, fontWeight: 800, fontSize: size, lineHeight: 1.35, color: C.ink, textAlign: 'center', minHeight: size * 1.35}}>
          <span>{chars.slice(0, typed).join('')}</span>
          <span style={{opacity: 0}}>{chars.slice(typed).join('')}</span>
        </div>
        <div style={{marginTop: 34, textAlign: 'right', fontFamily: FONT_BODY, fontWeight: 800, fontSize: 32, color: C.inkSoft, opacity: interpolate(frame, [20, 30], [0, 1], clamp)}}>
          ― {props.cite}
        </div>
        {props.note ? (
          <div style={{marginTop: 8, textAlign: 'right', fontFamily: FONT_BODY, fontWeight: 500, fontSize: 26, color: C.muted, opacity: interpolate(frame, [24, 34], [0, 1], clamp)}}>{props.note}</div>
        ) : null}
      </div>
    </MainArea>
  );
};
