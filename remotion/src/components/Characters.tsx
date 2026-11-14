import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_BODY, LAYOUT} from '../theme';
import {clamp} from '../timing';
import type {Emotion, Speaker} from '../types';

export type FlatLine = {
  id: string;
  speaker: Speaker;
  text: string;
  emotion: Emotion;
  start: number;
  end: number;
  /** 次のセリフが始まる（または シーンが終わる）フレーム。字幕はここまで残す */
  holdUntil: number;
};

const SIZE = 168;

/** 自作の丸アイコン（第三者のイラストは使わない） */
const Face: React.FC<{speaker: Speaker; emotion: Emotion; talking: boolean; mouthOpen: boolean}> = ({
  speaker,
  emotion,
  talking,
  mouthOpen,
}) => {
  const color = speaker === 'zundamon' ? C.zundamon : C.metan;
  const dark = speaker === 'zundamon' ? C.zundamonDark : C.metanDark;
  const eyeY = 78;
  const eyes =
    emotion === 'happy' ? (
      <>
        <path d="M 52 82 Q 62 70 72 82" stroke={C.ink} strokeWidth={6} fill="none" strokeLinecap="round" />
        <path d="M 96 82 Q 106 70 116 82" stroke={C.ink} strokeWidth={6} fill="none" strokeLinecap="round" />
      </>
    ) : emotion === 'surprised' ? (
      <>
        <circle cx={62} cy={eyeY} r={11} fill="#fff" stroke={C.ink} strokeWidth={4} />
        <circle cx={106} cy={eyeY} r={11} fill="#fff" stroke={C.ink} strokeWidth={4} />
        <circle cx={62} cy={eyeY} r={4} fill={C.ink} />
        <circle cx={106} cy={eyeY} r={4} fill={C.ink} />
      </>
    ) : (
      <>
        <circle cx={62} cy={eyeY} r={7} fill={C.ink} />
        <circle cx={106} cy={eyeY} r={7} fill={C.ink} />
        {emotion === 'sad' ? (
          <>
            <path d="M 48 62 L 72 56" stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
            <path d="M 120 62 L 96 56" stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
          </>
        ) : null}
      </>
    );
  const mouth =
    emotion === 'surprised' ? (
      <ellipse cx={84} cy={118} rx={12} ry={talking && mouthOpen ? 16 : 12} fill={C.ink} />
    ) : talking && mouthOpen ? (
      <ellipse cx={84} cy={114} rx={16} ry={11} fill={C.ink} />
    ) : emotion === 'sad' ? (
      <path d="M 66 122 Q 84 108 102 122" stroke={C.ink} strokeWidth={6} fill="none" strokeLinecap="round" />
    ) : (
      <path d="M 66 108 Q 84 126 102 108" stroke={C.ink} strokeWidth={6} fill="none" strokeLinecap="round" />
    );
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 168 168">
      <circle cx={84} cy={84} r={80} fill={color} stroke={dark} strokeWidth={6} />
      <circle cx={84} cy={92} r={60} fill="#FFF6EC" />
      <circle cx={44} cy={104} r={9} fill={color} opacity={0.35} />
      <circle cx={124} cy={104} r={9} fill={color} opacity={0.35} />
      {eyes}
      {mouth}
    </svg>
  );
};

const Character: React.FC<{speaker: Speaker; line: FlatLine | undefined; x: number}> = ({speaker, line, x}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const isSpeaker = line?.speaker === speaker;
  const talking = Boolean(isSpeaker && line && frame >= line.start && frame < line.end);
  const sinceStart = line ? frame - line.start : 0;
  const emotion: Emotion = isSpeaker && line ? line.emotion : 'normal';
  const name = speaker === 'zundamon' ? 'ずんだもん' : '四国めたん';
  const color = speaker === 'zundamon' ? C.zundamon : C.metan;
  const pop = isSpeaker ? interpolate(sinceStart, [0, 4, 9], [1, 1.1, 1.06], clamp) : 1;
  const bob = talking ? Math.sin((frame / fps) * Math.PI * 4) * 4 : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: LAYOUT.bottomTop + 14,
        width: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: isSpeaker || !line ? 1 : 0.45,
        filter: isSpeaker || !line ? 'none' : 'saturate(0.4)',
        scale: String(pop),
        translate: `0px ${bob}px`,
      }}
    >
      <Face speaker={speaker} emotion={emotion} talking={talking} mouthOpen={Math.floor(frame / 3) % 2 === 0} />
      <div
        style={{
          marginTop: 6,
          padding: '4px 18px',
          borderRadius: 999,
          background: color,
          color: '#fff',
          fontFamily: FONT_BODY,
          fontWeight: 800,
          fontSize: 28,
          letterSpacing: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </div>
    </div>
  );
};

export const Characters: React.FC<{lines: FlatLine[]}> = ({lines}) => {
  const frame = useCurrentFrame();
  const current = findLine(lines, frame);
  return (
    <>
      <Character speaker="metan" line={current} x={36} />
      <Character speaker="zundamon" line={current} x={1920 - 236} />
    </>
  );
};

/** 字幕・話者の強調に使う「いまのセリフ」（次のセリフまで保持） */
export function findLine(lines: FlatLine[], frame: number): FlatLine | undefined {
  let lo = 0;
  let hi = lines.length - 1;
  let found: FlatLine | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].start <= frame) {
      found = lines[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found && frame < found.holdUntil ? found : undefined;
}
