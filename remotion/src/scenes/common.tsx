import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_BODY, LAYOUT} from '../theme';
import {clamp, enter} from '../timing';

/** シーン部品の描画領域（フリップの内側）。シーンの頭に右から滑り込む */
export const MainArea: React.FC<{children: React.ReactNode; style?: React.CSSProperties; shake?: number}> = ({children, style, shake = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = enter(frame, 0, fps, 15);
  return (
    <div
      style={{
        position: 'absolute',
        left: LAYOUT.mainLeft,
        top: LAYOUT.mainTop,
        width: LAYOUT.mainWidth,
        height: LAYOUT.mainHeight,
        opacity: interpolate(frame, [0, 4], [0, 1], clamp),
        translate: `${interpolate(s, [0, 1], [70, 0]) + shake}px ${shake * 0.4}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** 見出し：章の色の帯に黒文字 */
export const Heading: React.FC<{children: React.ReactNode; accent: string}> = ({children, accent}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{display: 'flex'}}>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 800,
          fontSize: 46,
          lineHeight: 1.2,
          color: C.ink,
          background: accent,
          border: `5px solid ${C.ink}`,
          borderRadius: 14,
          padding: '6px 26px 8px',
          boxShadow: `6px 6px 0 ${C.ink}`,
          rotate: '-1deg',
          clipPath: `inset(0 ${interpolate(frame, [2, 12], [100, 0], clamp)}% 0 0)`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
