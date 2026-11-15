import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_BODY, FONT_DISPLAY} from '../theme';
import {enter, staggered} from '../timing';
import type {TimelineProps, TimelineScene as TScene} from '../types';
import {Heading, MainArea} from './common';

const YEAR_W = 250;
const GAP = 26;
const DOT = 44;

/** 年表：年と出来事が順に、弾むように現れる */
export const TimelineScene: React.FC<{scene: TScene; props: TimelineProps}> = ({scene, props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const starts = staggered(scene, props.items);
  const n = props.items.length;
  const rowH = Math.min(122, 486 / Math.max(1, n));
  const labelSize = n >= 5 ? 38 : 44;
  const lineX = YEAR_W + GAP + DOT / 2 - 6;
  const lastShown = starts.reduce((acc, s, i) => (frame >= s ? i : acc), -1);
  return (
    <MainArea>
      {props.heading ? <Heading accent={scene.accent}>{props.heading}</Heading> : null}
      <div style={{position: 'relative', marginTop: 34}}>
        <div style={{position: 'absolute', left: lineX, top: rowH / 2, width: 12, height: rowH * (n - 1), background: C.ink, borderRadius: 6}} />
        {props.items.map((it, i) => {
          const s = enter(frame, starts[i], fps, 9);
          const shown = frame >= starts[i];
          const latest = i === lastShown;
          const hi = it.highlight;
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
                opacity: shown ? Math.min(1, s * 1.5) : 0,
                translate: `${interpolate(s, [0, 1], [-120, 0])}px 0px`,
              }}
            >
              <div style={{width: YEAR_W, flexShrink: 0, display: 'flex', justifyContent: 'flex-end'}}>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: it.year.length > 5 ? 40 : 50,
                    lineHeight: 1,
                    color: hi ? '#fff' : C.ink,
                    background: hi ? C.red : scene.accent,
                    border: `5px solid ${C.ink}`,
                    borderRadius: 12,
                    padding: '8px 14px 10px',
                    rotate: '-3deg',
                  }}
                >
                  {it.year}
                </div>
              </div>
              <div
                style={{
                  width: DOT,
                  height: DOT,
                  marginLeft: GAP,
                  marginRight: GAP,
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  borderRadius: DOT / 2,
                  background: hi ? C.red : '#fff',
                  border: `8px solid ${C.ink}`,
                  scale: String(interpolate(s, [0, 1], [0.2, 1])),
                }}
              />
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 800,
                  fontSize: labelSize,
                  lineHeight: 1.22,
                  color: C.ink,
                  background: hi ? C.redSoft : '#fff',
                  border: `5px solid ${C.ink}`,
                  borderRadius: 18,
                  padding: '10px 26px 12px',
                  maxWidth: 1260,
                  boxShadow: latest ? `8px 8px 0 ${scene.accent}` : `5px 5px 0 rgba(27,25,35,0.18)`,
                  scale: latest ? String(interpolate(frame - starts[i], [0, 6, 12], [1, 1.05, 1.02], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})) : '1',
                  transformOrigin: 'left center',
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
