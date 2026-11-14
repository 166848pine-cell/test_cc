import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_BODY, FONT_DISPLAY, formatNumber} from '../theme';
import {clamp, enter} from '../timing';
import type {BarChartProps} from '../types';
import {Heading, MainArea} from './common';

const CHART_W = 1728;
const CHART_H = 430;
const LABEL_H = 44;

/** 年度別の棒グラフ。0 を境に黒字は上、赤字は下に伸びる */
export const BarChartScene: React.FC<{props: BarChartProps}> = ({props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const values = props.bars.map((b) => b.value);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const pad = 46; // 数値ラベルの余白
  const plotH = CHART_H - pad * (max > 0 && min < 0 ? 2 : 1);
  const scale = plotH / (max - min || 1);
  const zeroY = pad + max * scale;
  const n = props.bars.length;
  const slot = CHART_W / n;
  const barW = Math.min(150, slot * 0.62);
  const valueSize = n > 9 ? 27 : 36;
  return (
    <MainArea>
      {props.heading ? <Heading>{props.heading}</Heading> : null}
      <div style={{position: 'relative', marginTop: 24, width: CHART_W, height: CHART_H + LABEL_H}}>
        {/* 0 の線 */}
        <div style={{position: 'absolute', left: 0, width: CHART_W, top: zeroY - 2, height: 4, background: C.ink, borderRadius: 2}} />
        <div style={{position: 'absolute', left: -6, top: zeroY - 40, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 22, color: C.muted}}>0</div>
        {props.bars.map((b, i) => {
          const g = enter(frame, 6 + i * 4, fps, 16);
          const h = Math.abs(b.value) * scale * g;
          const hi = props.highlight?.includes(b.label);
          const neg = b.value < 0;
          const fill = hi ? (neg ? C.minus : C.gold) : neg ? '#E9A39E' : '#8FB8A6';
          const x = i * slot + (slot - barW) / 2;
          return (
            <div key={b.label}>
              <div
                style={{
                  position: 'absolute',
                  left: x,
                  width: barW,
                  top: neg ? zeroY + 2 : zeroY - 2 - h,
                  height: Math.max(h, 2),
                  background: fill,
                  borderRadius: neg ? '0 0 10px 10px' : '10px 10px 0 0',
                  boxShadow: hi ? `0 0 0 4px ${C.ink}` : 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: i * slot,
                  width: slot,
                  textAlign: 'center',
                  top: neg ? zeroY + 8 + h : zeroY - 8 - h - valueSize * 1.2,
                  fontFamily: FONT_DISPLAY,
                  fontSize: hi ? valueSize * 1.15 : valueSize,
                  lineHeight: 1.2,
                  color: neg ? C.minus : C.ink,
                  opacity: interpolate(g, [0.6, 1], [0, 1], clamp),
                  whiteSpace: 'nowrap',
                }}
              >
                {formatNumber(b.value)}
              </div>
              <div style={{position: 'absolute', left: i * slot, width: slot, top: CHART_H + 6, textAlign: 'center', fontFamily: FONT_BODY, fontWeight: 800, fontSize: n > 9 ? 28 : 34, color: hi ? C.accent : C.inkSoft}}>
                {b.label}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: FONT_BODY, fontWeight: 500, fontSize: 23, color: C.muted}}>
        <span>{props.footnote ?? ''}</span>
        <span>単位：{props.unit}</span>
      </div>
    </MainArea>
  );
};
