import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_BODY, FONT_DISPLAY} from '../theme';
import {clamp} from '../timing';
import type {QuoteProps, TimelineScene} from '../types';
import {MainArea} from './common';

/** 報告書などからの短い引用（出典表示つき）。文字が打たれたあと、蛍光ペンが引かれる */
export const QuoteScene: React.FC<{scene: TimelineScene; props: QuoteProps}> = ({scene, props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const chars = [...props.text];
  const typeEnd = 6 + Math.min(1.4 * fps, chars.length * 2);
  const typed = Math.round(interpolate(frame, [6, typeEnd], [0, chars.length], clamp));
  const marker = interpolate(frame, [typeEnd + 4, typeEnd + 4 + 0.5 * fps], [0, 100], clamp);
  const len = chars.length;
  const size = len <= 8 ? 140 : len <= 18 ? 80 : 62;
  return (
    <MainArea style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          position: 'relative',
          width: 1560,
          boxSizing: 'border-box',
          padding: '76px 90px 50px',
          background: '#fff',
          borderRadius: 20,
          border: `6px solid ${C.ink}`,
          boxShadow: `12px 12px 0 ${scene.accent}`,
          rotate: '-1deg',
        }}
      >
        {/* 書類っぽい見出し帯 */}
        <div style={{position: 'absolute', left: -6, right: -6, top: -6, height: 50, background: C.ink, borderRadius: '20px 20px 0 0', display: 'flex', alignItems: 'center', paddingLeft: 30}}>
          <span style={{fontFamily: FONT_DISPLAY, fontSize: 26, color: scene.accent}}>報告書より引用</span>
        </div>
        <div style={{position: 'absolute', left: 24, top: 34, fontFamily: FONT_DISPLAY, fontSize: 150, lineHeight: 1, color: scene.accent, WebkitTextStroke: `5px ${C.ink}`}}>“</div>
        <div style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: size, lineHeight: 1.4, color: C.ink, textAlign: 'center', minHeight: size * 1.4}}>
          <span
            style={{
              backgroundImage: `linear-gradient(transparent 58%, ${C.yellow} 58%, ${C.yellow} 92%, transparent 92%)`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: `${marker}% 100%`,
            }}
          >
            {chars.slice(0, typed).join('')}
          </span>
          <span style={{opacity: 0}}>{chars.slice(typed).join('')}</span>
        </div>
        <div style={{marginTop: 30, textAlign: 'right', fontFamily: FONT_BODY, fontWeight: 800, fontSize: 32, color: C.inkSoft, opacity: interpolate(frame, [20, 30], [0, 1], clamp)}}>― {props.cite}</div>
        {props.note ? (
          <div style={{marginTop: 6, textAlign: 'right', fontFamily: FONT_BODY, fontWeight: 800, fontSize: 25, color: C.muted, opacity: interpolate(frame, [24, 34], [0, 1], clamp)}}>{props.note}</div>
        ) : null}
      </div>
    </MainArea>
  );
};
