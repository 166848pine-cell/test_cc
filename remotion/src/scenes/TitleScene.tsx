import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_BODY, FONT_DISPLAY} from '../theme';
import {clamp, enter} from '../timing';
import type {TitleProps} from '../types';
import {MainArea} from './common';

export const TitleScene: React.FC<{props: TitleProps}> = ({props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const episode = props.variant === 'episode';
  const pop = enter(frame, 2, fps, 12);
  const titleLen = [...props.title].length;
  const titleSize = episode ? (titleLen > 12 ? 104 : 120) : titleLen > 14 ? 76 : titleLen > 9 ? 96 : 132;
  return (
    <MainArea style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
      {/* 斜めの帯 */}
      <div
        style={{
          position: 'absolute',
          left: -40,
          right: -40,
          top: 200,
          height: 240,
          background: episode ? C.ink : C.accent,
          rotate: '-3deg',
          scale: `${interpolate(frame, [0, 10], [0, 1], clamp)} 1`,
          transformOrigin: 'left center',
          opacity: episode ? 0.95 : 0.92,
        }}
      />
      {props.kicker ? (
        <div
          style={{
            position: 'relative',
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 44,
            color: episode ? C.accent : C.ink,
            background: '#fff',
            border: `4px solid ${C.ink}`,
            borderRadius: 14,
            padding: '6px 28px',
            marginBottom: 34,
            rotate: '-3deg',
            opacity: interpolate(frame, [4, 12], [0, 1], clamp),
          }}
        >
          {props.kicker}
        </div>
      ) : null}
      <div
        style={{
          position: 'relative',
          fontFamily: FONT_DISPLAY,
          fontSize: titleSize,
          lineHeight: 1.15,
          color: '#fff',
          textAlign: 'center',
          maxWidth: 1600,
          rotate: '-3deg',
          scale: String(interpolate(pop, [0, 1], [0.6, 1])),
          opacity: pop,
          textShadow: '0 6px 0 rgba(0,0,0,0.25)',
        }}
      >
        {props.title}
      </div>
      {props.subtitle ? (
        <div
          style={{
            position: 'relative',
            marginTop: 52,
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: episode ? 56 : 44,
            color: C.ink,
            opacity: interpolate(frame, [10, 18], [0, 1], clamp),
            translate: `0px ${interpolate(frame, [10, 18], [20, 0], clamp)}px`,
          }}
        >
          {props.subtitle}
        </div>
      ) : null}
    </MainArea>
  );
};
