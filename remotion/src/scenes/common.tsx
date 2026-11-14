import {interpolate, useCurrentFrame} from 'remotion';
import {C, FONT_BODY, LAYOUT} from '../theme';
import {clamp} from '../timing';

/** シーン部品の描画領域（上のヘッダーと下のキャラクター・字幕の間） */
export const MainArea: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left: LAYOUT.sideMargin,
        right: LAYOUT.sideMargin,
        top: LAYOUT.mainTop,
        height: LAYOUT.mainHeight,
        opacity: interpolate(frame, [0, 6], [0, 1], clamp),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Heading: React.FC<{children: React.ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        fontWeight: 800,
        fontSize: 50,
        color: C.ink,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        translate: `${interpolate(frame, [0, 10], [-30, 0], clamp)}px 0px`,
      }}
    >
      <div style={{width: 14, height: 50, borderRadius: 7, background: C.accent}} />
      {children}
    </div>
  );
};
