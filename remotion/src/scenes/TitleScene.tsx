import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Burst, Outlined} from '../components/Fx';
import {C, FONT_BODY, FONT_DISPLAY, shade} from '../theme';
import {clamp, enter} from '../timing';
import type {TimelineScene, TitleProps} from '../types';

const Tape: React.FC<{top: number; rotate: number; delay: number; text: string}> = ({top, rotate, delay, text}) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [delay, delay + 8], [-2200, 0], {...clamp, easing: (t) => 1 - Math.pow(1 - t, 3)});
  return (
    <div
      style={{
        position: 'absolute',
        left: -200,
        width: 2400,
        top,
        height: 64,
        rotate: `${rotate}deg`,
        translate: `${x}px 0px`,
        background: `repeating-linear-gradient(-45deg, ${C.yellow} 0 34px, ${C.ink} 34px 68px)`,
        borderTop: `5px solid ${C.ink}`,
        borderBottom: `5px solid ${C.ink}`,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <div style={{fontFamily: FONT_DISPLAY, fontSize: 34, color: C.ink, background: C.yellow, padding: '0 20px', marginLeft: 460 - (frame - delay) * 3, whiteSpace: 'nowrap'}}>
        {text}
      </div>
    </div>
  );
};

/** 扉（章の始まり）と、回のタイトル画面。フリップを使わず全面で見せる */
export const TitleScene: React.FC<{scene: TimelineScene; props: TitleProps}> = ({scene, props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const episode = props.variant === 'episode';
  const pop = enter(frame, 4, fps, 10);
  const titleLen = [...props.title].length;
  const titleSize = episode ? 128 : titleLen > 14 ? 88 : titleLen > 9 ? 112 : 150;
  const bg = episode ? C.stage : scene.accent;
  return (
    <AbsoluteFill style={{background: bg, overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 45%, ${shade(bg, 0.25)} 0%, ${shade(bg, -0.35)} 75%)`}} />
      <Burst color={episode ? scene.accent : '#ffffff'} size={2600} rays={36} opacity={episode ? 0.18 : 0.16} />
      <Tape top={70} rotate={-4} delay={0} text={`やらかした会社　${episode ? 'OPENING' : props.kicker ?? ''}　KEEP OUT　やらかした会社　KEEP OUT`} />
      <Tape top={668} rotate={3} delay={3} text="KEEP OUT　やらかした会社　KEEP OUT　やらかした会社　KEEP OUT" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', paddingBottom: 260}}>
        {props.kicker ? (
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: episode ? 52 : 64,
              color: C.ink,
              background: '#fff',
              border: `6px solid ${C.ink}`,
              borderRadius: 16,
              padding: '4px 30px 10px',
              marginBottom: 28,
              rotate: '-4deg',
              boxShadow: `8px 8px 0 ${C.ink}`,
              scale: String(interpolate(frame, [2, 8], [0, 1], clamp)),
            }}
          >
            {episode ? props.kicker : props.kicker}
          </div>
        ) : null}
        <div style={{rotate: '-3deg', scale: String(interpolate(pop, [0, 1], [2.2, 1])), opacity: interpolate(pop, [0, 0.3], [0, 1], clamp), textAlign: 'center', maxWidth: 1700}}>
          <Outlined
            fill={episode ? C.yellow : '#fff'}
            strokes={[
              {w: 16, color: C.ink},
              {w: 8, color: episode ? C.red : shade(scene.accent, -0.45)},
            ]}
            style={{fontFamily: FONT_DISPLAY, fontSize: titleSize, lineHeight: 1.15, whiteSpace: 'nowrap'}}
          >
            {props.title}
          </Outlined>
        </div>
        {props.subtitle ? (
          <div style={{marginTop: 34, opacity: interpolate(frame, [10, 16], [0, 1], clamp), translate: `0px ${interpolate(frame, [10, 16], [24, 0], clamp)}px`}}>
            <Outlined strokes={[{w: 10, color: C.ink}]} style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: episode ? 62 : 50}}>
              {props.subtitle}
            </Outlined>
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
