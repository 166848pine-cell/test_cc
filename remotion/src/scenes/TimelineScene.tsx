import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_BODY, FONT_DISPLAY} from '../theme';
import {enter, staggered} from '../timing';
import type {TimelineProps, TimelineScene as TScene} from '../types';
import {Heading, MainArea} from './common';

const YEAR_W = 230;
const GAP = 28;
const DOT = 40;

/** 年表：年と出来事が順に現れる */
export const TimelineScene: React.FC<{scene: TScene; props: TimelineProps}> = ({scene, props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const starts = staggered(scene, props.items);
  const n = props.items.length;
  const rowH = Math.min(118, 500 / Math.max(1, n));
  const labelSize = n >= 5 ? 38 : 44;
  const lineX = YEAR_W + GAP + DOT / 2 - 4;
  return (
    <MainArea>
      {props.heading ? <Heading>{props.heading}</Heading> : null}
      <div style={{position: 'relative', marginTop: 40}}>
        <div style={{position: 'absolute', left: lineX, top: rowH / 2, width: 8, height: rowH * (n - 1), background: C.line, borderRadius: 4}} />
        {props.items.map((it, i) => {
          const s = enter(frame, starts[i], fps);
          const shown = frame >= starts[i];
          const color = it.highlight ? C.accent : C.ink;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: i * rowH,
                left: 0,
                right: 0,
                height: rowH,
                display: 'flex',
                alignItems: 'center',
                opacity: shown ? s : 0,
                translate: `${interpolate(s, [0, 1], [-60, 0])}px 0px`,
              }}
            >
              <div style={{width: YEAR_W, flexShrink: 0, textAlign: 'right', fontFamily: FONT_DISPLAY, fontSize: it.year.length > 5 ? 42 : 52, color}}>{it.year}</div>
              <div
                style={{
                  width: DOT,
                  height: DOT,
                  marginLeft: GAP,
                  marginRight: GAP,
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  borderRadius: DOT / 2,
                  background: color,
                  border: '7px solid #fff',
                  boxShadow: `0 0 0 4px ${color}`,
                  scale: String(interpolate(s, [0, 1], [0.2, 1])),
                }}
              />
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 800,
                  fontSize: labelSize,
                  lineHeight: 1.25,
                  color: C.ink,
                  background: it.highlight ? C.accentSoft : C.card,
                  border: `3px solid ${it.highlight ? C.accent : C.line}`,
                  borderRadius: 18,
                  padding: '10px 26px',
                  maxWidth: 1340,
                }}
              >
                {it.label}
              </div>
            </div>
          );
        })}
      </div>
    </MainArea>
  );
};
