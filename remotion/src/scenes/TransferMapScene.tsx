import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_BODY, FONT_DISPLAY} from '../theme';
import {clamp, enter, staggered} from '../timing';
import type {TimelineScene, TransferMapProps} from '../types';
import {Heading, MainArea} from './common';

const FROM_W = 240;
const TAG_X = 300;
const TAG_W = 300;
const ARROW_X = TAG_X + TAG_W + 10;
const ARROW_W = 170;
const TO_X = ARROW_X + ARROW_W + 10;

/** 事業売却の図：値札のついた事業に「売却済」のハンコが押され、買い手へ矢印が伸びる */
export const TransferMapScene: React.FC<{scene: TimelineScene; props: TransferMapProps}> = ({scene, props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const starts = staggered(scene, props.items);
  const n = props.items.length;
  const rowH = Math.min(102, 500 / Math.max(1, n));
  const listH = rowH * n;
  const sold = starts.filter((s) => frame >= s + 10).length;
  const shrink = interpolate(sold, [0, n], [1, 0.72], clamp);
  return (
    <MainArea>
      {props.heading ? <Heading accent={scene.accent}>{props.heading}</Heading> : null}
      <div style={{position: 'relative', marginTop: 26, height: listH}}>
        {props.items.map((it, i) =>
          frame >= starts[i] ? (
            <div key={`link-${i}`} style={{position: 'absolute', left: FROM_W / 2, top: i * rowH + rowH / 2 - 3, width: (TAG_X - FROM_W / 2) * enter(frame, starts[i], fps, 13), height: 6, background: C.ink}} />
          ) : null,
        )}
        {/* 売り手（だんだん小さくなる） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: listH / 2 - 120,
            width: FROM_W,
            height: 240,
            borderRadius: 28,
            background: C.ink,
            border: `6px solid ${C.ink}`,
            boxShadow: `8px 8px 0 ${scene.accent}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            scale: String(shrink),
          }}
        >
          <div style={{fontFamily: FONT_DISPLAY, fontSize: 72, color: '#fff'}}>{props.from}</div>
          <div style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 24, color: scene.accent}}>売却 {sold} 件</div>
        </div>
        {props.items.map((it, i) => {
          const s = starts[i];
          if (frame < s) return null;
          const tag = enter(frame, s, fps, 11);
          const arrow = interpolate(frame, [s + 4, s + 12], [0, 1], clamp);
          const dest = enter(frame, s + 9, fps, 11);
          const stampT = frame - (s + 8);
          const y = i * rowH;
          return (
            <div key={i}>
              {/* 値札 */}
              <div
                style={{
                  position: 'absolute',
                  left: TAG_X,
                  top: y + 8,
                  width: TAG_W,
                  height: rowH - 16,
                  boxSizing: 'border-box',
                  background: C.yellow,
                  border: `5px solid ${C.ink}`,
                  borderRadius: '14px 40px 40px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 26,
                  fontFamily: FONT_BODY,
                  fontWeight: 800,
                  fontSize: 38,
                  color: C.ink,
                  translate: `${interpolate(tag, [0, 1], [-200, 0])}px 0px`,
                  rotate: `${interpolate(tag, [0, 1], [-12, i % 2 === 0 ? -2 : 2])}deg`,
                  opacity: Math.min(1, tag * 2),
                }}
              >
                <div style={{position: 'absolute', right: 22, width: 16, height: 16, borderRadius: 8, background: C.board, border: `4px solid ${C.ink}`}} />
                {it.what}
                {stampT >= 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      right: -18,
                      top: -22,
                      fontFamily: FONT_DISPLAY,
                      fontSize: 26,
                      lineHeight: 1,
                      color: C.red,
                      border: `4px solid ${C.red}`,
                      borderRadius: 8,
                      padding: '6px 8px 8px',
                      background: 'rgba(255,255,255,0.85)',
                      rotate: '-14deg',
                      scale: String(interpolate(stampT, [0, 4, 7], [2.2, 0.92, 1], clamp)),
                      opacity: interpolate(stampT, [0, 2], [0, 1], clamp),
                    }}
                  >
                    売却
                  </div>
                ) : null}
              </div>
              <svg style={{position: 'absolute', left: ARROW_X, top: y + rowH / 2 - 34}} width={ARROW_W} height={60} viewBox={`0 0 ${ARROW_W} 60`}>
                {it.when ? (
                  <text x={ARROW_W / 2 - 12} y={18} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={22} fill={C.ink} opacity={arrow}>
                    {it.when}
                  </text>
                ) : null}
                <line x1={6} y1={38} x2={6 + (ARROW_W - 36) * arrow} y2={38} stroke={C.red} strokeWidth={12} strokeLinecap="round" />
                {arrow > 0.95 ? <polygon points={`${ARROW_W - 40},20 ${ARROW_W - 2},38 ${ARROW_W - 40},56`} fill={C.red} stroke={C.ink} strokeWidth={3} /> : null}
              </svg>
              <div
                style={{
                  position: 'absolute',
                  left: TO_X,
                  top: y + 8,
                  height: rowH - 16,
                  minWidth: 520,
                  maxWidth: 1712 - TO_X,
                  boxSizing: 'border-box',
                  padding: '0 26px',
                  borderRadius: 18,
                  background: '#fff',
                  border: `5px solid ${C.ink}`,
                  boxShadow: `6px 6px 0 ${scene.accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 24,
                  opacity: Math.min(1, dest * 2),
                  scale: String(interpolate(dest, [0, 1], [0.6, 1])),
                  transformOrigin: 'left center',
                }}
              >
                <span style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 38, color: C.ink, whiteSpace: 'nowrap'}}>{it.to}</span>
                {it.detail ? <span style={{fontFamily: FONT_DISPLAY, fontSize: 30, color: C.red, whiteSpace: 'nowrap'}}>{it.detail}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </MainArea>
  );
};
