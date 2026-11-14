import {interpolate, useCurrentFrame} from 'remotion';
import {C, FONT_BODY, LAYOUT} from '../theme';
import {clamp} from '../timing';
import {findLine, type FlatLine} from './Characters';

export const Subtitle: React.FC<{lines: FlatLine[]}> = ({lines}) => {
  const frame = useCurrentFrame();
  const line = findLine(lines, frame);
  if (!line) return null;
  const color = line.speaker === 'zundamon' ? C.zundamon : C.metan;
  const name = line.speaker === 'zundamon' ? 'ずんだもん' : '四国めたん';
  const len = [...line.text].length;
  // 2 行に収まるよう、長いセリフは少し小さくする（枠の幅 1300px）
  const fontSize = len > 50 ? 42 : len > 40 ? 46 : 50;
  const t = frame - line.start;
  return (
    <div
      style={{
        position: 'absolute',
        left: 270,
        width: 1380,
        top: LAYOUT.bottomTop + 26,
        height: 214,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 150,
          boxSizing: 'border-box',
          padding: '30px 40px 26px',
          background: C.card,
          border: `5px solid ${color}`,
          borderRadius: 28,
          boxShadow: '0 10px 0 rgba(43,42,51,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: interpolate(t, [0, 4], [0.6, 1], clamp),
          translate: `0px ${interpolate(t, [0, 5], [8, 0], clamp)}px`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -24,
            left: line.speaker === 'metan' ? 36 : undefined,
            right: line.speaker === 'zundamon' ? 36 : undefined,
            padding: '2px 18px',
            borderRadius: 12,
            background: color,
            color: '#fff',
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 26,
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize,
            lineHeight: 1.38,
            color: C.ink,
            textAlign: 'center',
            wordBreak: 'normal',
            overflowWrap: 'anywhere',
            lineBreak: 'strict',
          }}
        >
          {line.text}
        </div>
      </div>
    </div>
  );
};
