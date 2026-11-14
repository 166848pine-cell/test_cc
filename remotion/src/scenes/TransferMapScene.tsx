import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_BODY, FONT_DISPLAY} from '../theme';
import {clamp, enter, staggered} from '../timing';
import type {TimelineScene, TransferMapProps} from '../types';
import {Heading, MainArea} from './common';

const FROM_W = 250;
const WHAT_X = 330;
const WHAT_W = 230;
const ARROW_X = WHAT_X + WHAT_W + 16;
const ARROW_W = 190;
const TO_X = ARROW_X + ARROW_W + 16;

/** 事業売却の図：「どの事業が → どこに売られたか」を矢印で順に出す */
export const TransferMapScene: React.FC<{scene: TimelineScene; props: TransferMapProps}> = ({scene, props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const starts = staggered(scene, props.items);
  const n = props.items.length;
  const rowH = Math.min(108, 520 / Math.max(1, n));
  const top0 = 30;
  const listH = rowH * n;
  // 何件売れたかで、売り手の箱が少しずつ縮む
  const sold = starts.filter((s) => frame >= s + 10).length;
  const shrink = interpolate(sold, [0, n], [1, 0.8], clamp);
  return (
    <MainArea>
      {props.heading ? <Heading>{props.heading}</Heading> : null}
      <div style={{position: 'relative', marginTop: top0, height: listH}}>
        {props.items.map((it, i) =>
          frame >= starts[i] ? (
            <div key={`link-${i}`} style={{position: 'absolute', left: FROM_W / 2, top: i * rowH + rowH / 2 - 2, width: (WHAT_X - FROM_W / 2) * enter(frame, starts[i], fps, 13), height: 4, background: C.line}} />
          ) : null,
        )}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: listH / 2 - 110,
            width: FROM_W,
            height: 220,
            borderRadius: 30,
            background: C.ink,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT_DISPLAY,
            fontSize: 76,
            scale: String(shrink),
            boxShadow: '0 10px 0 rgba(43,42,51,0.18)',
          }}
        >
          {props.from}
        </div>
        {props.items.map((it, i) => {
          const s = starts[i];
          const chip = enter(frame, s, fps, 13);
          const arrow = interpolate(frame, [s + 4, s + 14], [0, 1], clamp);
          const dest = enter(frame, s + 10, fps, 12);
          const y = i * rowH;
          if (frame < s) return null;
          return (
            <div key={i}>
              <div
                style={{
                  position: 'absolute',
                  left: WHAT_X,
                  top: y + 8,
                  width: WHAT_W,
                  height: rowH - 16,
                  borderRadius: 18,
                  background: C.card,
                  border: `4px solid ${C.ink}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: FONT_BODY,
                  fontWeight: 800,
                  fontSize: 38,
                  color: C.ink,
                  translate: `${interpolate(chip, [0, 1], [-160, 0])}px 0px`,
                  opacity: chip,
                }}
              >
                {it.what}
              </div>
              <svg style={{position: 'absolute', left: ARROW_X, top: y + rowH / 2 - 36}} width={ARROW_W} height={58} viewBox={`0 0 ${ARROW_W} 58`}>
                <line x1={4} y1={36} x2={4 + (ARROW_W - 30) * arrow} y2={36} stroke={C.accent} strokeWidth={8} strokeLinecap="round" />
                {arrow > 0.95 ? <polygon points={`${ARROW_W - 34},20 ${ARROW_W - 2},36 ${ARROW_W - 34},52`} fill={C.accent} /> : null}
                {it.when ? (
                  <text x={ARROW_W / 2 - 10} y={20} textAnchor="middle" fontFamily={FONT_BODY} fontWeight={800} fontSize={22} fill={C.inkSoft} opacity={arrow}>
                    {it.when}
                  </text>
                ) : null}
              </svg>
              <div
                style={{
                  position: 'absolute',
                  left: TO_X,
                  top: y + 8,
                  height: rowH - 16,
                  minWidth: 520,
                  maxWidth: 1728 - TO_X,
                  boxSizing: 'border-box',
                  padding: '0 26px',
                  borderRadius: 18,
                  background: C.accentSoft,
                  border: `4px solid ${C.accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 24,
                  opacity: dest,
                  scale: String(interpolate(dest, [0, 1], [0.7, 1])),
                  transformOrigin: 'left center',
                }}
              >
                <span style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 38, color: C.ink, whiteSpace: 'nowrap'}}>{it.to}</span>
                {it.detail ? <span style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 30, color: C.accent, whiteSpace: 'nowrap'}}>{it.detail}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </MainArea>
  );
};
