import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Burst} from '../components/Fx';
import {C, FONT_BODY, FONT_DISPLAY, formatNumber} from '../theme';
import {clamp, enter} from '../timing';
import type {BarChartProps, TimelineScene} from '../types';
import {Heading, MainArea} from './common';

const CHART_W = 1712;
const CHART_H = 420;
const LABEL_H = 44;

/** 年度別の棒グラフ。0 を境に黒字は上、赤字は下へ。強調の棒は最後に勢いよく伸びる */
export const BarChartScene: React.FC<{scene: TimelineScene; props: BarChartProps}> = ({scene, props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const values = props.bars.map((b) => b.value);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const pad = 50;
  const plotH = CHART_H - pad * (max > 0 && min < 0 ? 2 : 1);
  const scale = plotH / (max - min || 1);
  const zeroY = pad + max * scale;
  const n = props.bars.length;
  const slot = CHART_W / n;
  const barW = Math.min(160, slot * 0.64);
  const valueSize = n > 9 ? 27 : 38;
  const normalCount = props.bars.filter((b) => !props.highlight?.includes(b.label)).length;
  let k = 0;
  return (
    <MainArea>
      {props.heading ? <Heading accent={scene.accent}>{props.heading}</Heading> : null}
      <div style={{position: 'relative', marginTop: 20, width: CHART_W, height: CHART_H + LABEL_H, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: -10, width: CHART_W + 20, top: zeroY - 4, height: 8, background: C.ink, borderRadius: 4}} />
        {props.bars.map((b, i) => {
          const hi = props.highlight?.includes(b.label);
          // 強調の棒は、ほかの棒が出そろってから伸びる
          const start = hi ? 10 + normalCount * 4 + 12 : 8 + (k++) * 4;
          const g = hi ? enter(frame, start, fps, 8) : enter(frame, start, fps, 16);
          const h = Math.abs(b.value) * scale * g;
          const neg = b.value < 0;
          const fill = hi ? (neg ? C.red : C.yellow) : neg ? '#FF8A8A' : '#5CC8A0';
          const x = i * slot + (slot - barW) / 2;
          return (
            <div key={b.label}>
              {hi && frame > start ? (
                <div style={{position: 'absolute', left: x + barW / 2 - 150, top: neg ? zeroY : zeroY - h - 120, width: 300, height: 300, overflow: 'visible', opacity: interpolate(frame - start, [0, 8], [0, 1], clamp)}}>
                  <Burst color={scene.accent} size={420} rays={20} opacity={0.45} />
                </div>
              ) : null}
              <div
                style={{
                  position: 'absolute',
                  left: x,
                  width: barW,
                  top: neg ? zeroY + 2 : zeroY - 2 - h,
                  height: Math.max(h, 3),
                  boxSizing: 'border-box',
                  background: fill,
                  border: h > 6 ? `5px solid ${C.ink}` : 'none',
                  borderRadius: neg ? '0 0 12px 12px' : '12px 12px 0 0',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: i * slot - 20,
                  width: slot + 40,
                  textAlign: 'center',
                  top: neg ? zeroY + 10 + h : zeroY - 10 - h - valueSize * 1.25,
                  fontFamily: FONT_DISPLAY,
                  fontSize: hi ? valueSize * 1.3 : valueSize,
                  lineHeight: 1.2,
                  color: neg ? C.red : C.ink,
                  WebkitTextStroke: hi ? `1.5px ${C.ink}` : undefined,
                  opacity: interpolate(g, [0.6, 1], [0, 1], clamp),
                  whiteSpace: 'nowrap',
                }}
              >
                {formatNumber(b.value)}
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: i * slot,
                  width: slot,
                  top: CHART_H + 4,
                  textAlign: 'center',
                  fontFamily: FONT_BODY,
                  fontWeight: 800,
                  fontSize: n > 9 ? 27 : 34,
                  color: hi ? C.red : C.inkSoft,
                }}
              >
                {b.label}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: FONT_BODY, fontWeight: 800, fontSize: 21, color: C.muted}}>
        <span>{props.footnote ?? ''}</span>
        <span>単位：{props.unit}</span>
      </div>
    </MainArea>
  );
};
