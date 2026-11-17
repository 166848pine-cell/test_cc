import {Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_DISPLAY, LAYOUT} from '../theme';
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

const S = 240;

const Eyes: React.FC<{emotion: Emotion; blink: boolean}> = ({emotion, blink}) => {
  const L = 88;
  const R = 152;
  const Y = 132;
  if (emotion === 'happy') {
    return (
      <>
        {[L, R].map((x) => (
          <path key={x} d={`M ${x - 16} ${Y + 6} Q ${x} ${Y - 14} ${x + 16} ${Y + 6}`} stroke={C.ink} strokeWidth={8} fill="none" strokeLinecap="round" />
        ))}
      </>
    );
  }
  if (blink) {
    return (
      <>
        {[L, R].map((x) => (
          <path key={x} d={`M ${x - 15} ${Y} L ${x + 15} ${Y}`} stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
        ))}
      </>
    );
  }
  const big = emotion === 'surprised';
  const pupilDy = emotion === 'sad' ? 6 : 2;
  return (
    <>
      {[L, R].map((x, i) => (
        <g key={x}>
          <ellipse cx={x} cy={Y} rx={big ? 21 : 17} ry={big ? 25 : 21} fill="#fff" stroke={C.ink} strokeWidth={5} />
          <circle cx={x + (i === 0 ? 3 : -3)} cy={Y + pupilDy} r={big ? 6 : 10} fill={C.ink} />
          {!big ? <circle cx={x + (i === 0 ? -1 : -7)} cy={Y - 5 + pupilDy} r={4} fill="#fff" /> : null}
        </g>
      ))}
      {emotion === 'sad' ? (
        <>
          <path d={`M ${L - 20} ${Y - 30} L ${L + 14} ${Y - 38}`} stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
          <path d={`M ${R + 20} ${Y - 30} L ${R - 14} ${Y - 38}`} stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
        </>
      ) : null}
    </>
  );
};

const Mouth: React.FC<{emotion: Emotion; open: boolean}> = ({emotion, open}) => {
  const y = 176;
  if (emotion === 'surprised') return <ellipse cx={120} cy={y} rx={13} ry={open ? 19 : 15} fill="#7A1F2B" stroke={C.ink} strokeWidth={5} />;
  if (open) return <path d={`M 98 ${y - 6} Q 120 ${y - 10} 142 ${y - 6} Q 138 ${y + 22} 120 ${y + 22} Q 102 ${y + 22} 98 ${y - 6} Z`} fill="#7A1F2B" stroke={C.ink} strokeWidth={5} strokeLinejoin="round" />;
  if (emotion === 'sad') return <path d={`M 102 ${y + 8} Q 120 ${y - 10} 138 ${y + 8}`} stroke={C.ink} strokeWidth={7} fill="none" strokeLinecap="round" />;
  return <path d={`M 100 ${y - 6} Q 120 ${y + 14} 140 ${y - 6}`} stroke={C.ink} strokeWidth={7} fill="none" strokeLinecap="round" />;
};

/** 自作の丸いキャラクター（第三者のイラストは使わない） */
const Body: React.FC<{speaker: Speaker; emotion: Emotion; talking: boolean; mouthOpen: boolean; blink: boolean}> = ({speaker, emotion, talking, mouthOpen, blink}) => {
  const color = speaker === 'zundamon' ? C.zundamon : C.metan;
  const dark = speaker === 'zundamon' ? C.zundamonDark : C.metanDark;
  return (
    <svg width={S} height={S} viewBox="0 0 240 240" style={{overflow: 'visible'}}>
      {speaker === 'zundamon' ? (
        <g>
          <path d="M 120 58 C 118 40 122 30 126 18" stroke={dark} strokeWidth={7} fill="none" strokeLinecap="round" />
          <ellipse cx={104} cy={22} rx={22} ry={11} fill={color} stroke={C.ink} strokeWidth={5} transform="rotate(-25 104 22)" />
          <ellipse cx={146} cy={16} rx={22} ry={11} fill={color} stroke={C.ink} strokeWidth={5} transform="rotate(20 146 16)" />
        </g>
      ) : (
        <g>
          <path d="M 150 50 L 196 26 L 194 74 Z" fill={dark} stroke={C.ink} strokeWidth={5} strokeLinejoin="round" />
          <path d="M 150 50 L 112 22 L 112 70 Z" fill={dark} stroke={C.ink} strokeWidth={5} strokeLinejoin="round" />
          <circle cx={150} cy={49} r={13} fill={color} stroke={C.ink} strokeWidth={5} />
        </g>
      )}
      <rect x={22} y={46} width={196} height={188} rx={94} fill={color} stroke={C.ink} strokeWidth={8} />
      <ellipse cx={120} cy={148} rx={78} ry={70} fill="#FFF4E8" />
      <ellipse cx={66} cy={168} rx={14} ry={9} fill={color} opacity={0.55} />
      <ellipse cx={174} cy={168} rx={14} ry={9} fill={color} opacity={0.55} />
      <Eyes emotion={emotion} blink={blink && emotion !== 'happy'} />
      <Mouth emotion={emotion} open={talking && mouthOpen} />
    </svg>
  );
};

/** 感情の記号（！、汗、きらきら） */
const EmotionFx: React.FC<{emotion: Emotion; since: number; side: 'left' | 'right'}> = ({emotion, since, side}) => {
  const pop = interpolate(since, [0, 6], [0, 1], clamp);
  const x = side === 'left' ? 196 : 6;
  if (emotion === 'surprised') {
    return (
      <div style={{position: 'absolute', left: x, top: -36, fontFamily: FONT_DISPLAY, fontSize: 92, color: C.yellow, WebkitTextStroke: `6px ${C.ink}`, scale: String(interpolate(pop, [0, 1], [0.2, 1])), rotate: side === 'left' ? '14deg' : '-14deg'}}>
        ！
      </div>
    );
  }
  if (emotion === 'sad') {
    return (
      <svg style={{position: 'absolute', left: side === 'left' ? 184 : 10, top: 34, opacity: pop}} width={50} height={70} viewBox="0 0 50 70">
        <path d="M 25 4 C 34 22 44 34 44 46 A 19 19 0 0 1 6 46 C 6 34 16 22 25 4 Z" fill="#7EC8FF" stroke={C.ink} strokeWidth={4} />
      </svg>
    );
  }
  if (emotion === 'happy') {
    return (
      <>
        {[
          [side === 'left' ? 200 : -20, 10, 46],
          [side === 'left' ? 230 : -40, 80, 30],
        ].map(([l, t, s], i) => (
          <svg key={i} style={{position: 'absolute', left: l, top: t, scale: String(pop), rotate: `${since * 4}deg`}} width={s} height={s} viewBox="0 0 40 40">
            <path d="M 20 0 L 25 15 L 40 20 L 25 25 L 20 40 L 15 25 L 0 20 L 15 15 Z" fill={C.yellow} stroke={C.ink} strokeWidth={3} />
          </svg>
        ))}
      </>
    );
  }
  return null;
};

const Character: React.FC<{speaker: Speaker; line: FlatLine | undefined; side: 'left' | 'right'}> = ({speaker, line, side}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const isSpeaker = line?.speaker === speaker;
  const talking = Boolean(isSpeaker && line && frame >= line.start && frame < line.end);
  const since = line ? frame - line.start : 0;
  const emotion: Emotion = isSpeaker && line ? line.emotion : 'normal';
  const name = speaker === 'zundamon' ? 'ずんだもん' : '四国めたん';
  const dark = speaker === 'zundamon' ? C.zundamonDark : C.metanDark;
  const hop = isSpeaker ? interpolate(since, [0, 4, 8], [0, -26, 0], clamp) : 0;
  const bob = talking ? -Math.abs(Math.sin((frame / fps) * Math.PI * 3.2)) * 8 : Math.sin(frame / 20) * 2;
  const squash = talking ? 1 + Math.sin((frame / fps) * Math.PI * 6.4) * 0.025 : 1;
  const blink = frame % 100 < 4 || (frame + 37) % 173 < 3;
  return (
    <div
      style={{
        position: 'absolute',
        left: side === 'left' ? 18 : undefined,
        right: side === 'right' ? 18 : undefined,
        top: LAYOUT.bottomTop + 6,
        width: S,
        height: 290,
        translate: `0px ${hop + bob}px`,
        scale: `${isSpeaker ? 1.04 : 0.94} ${(isSpeaker ? 1.04 : 0.94) * squash}`,
        transformOrigin: 'bottom center',
        filter: isSpeaker || !line ? 'none' : 'brightness(0.8) saturate(0.75)',
      }}
    >
      <Body speaker={speaker} emotion={emotion} talking={talking} mouthOpen={Math.floor(frame / 3) % 2 === 0} blink={blink} />
      {isSpeaker ? <EmotionFx emotion={emotion} since={since} side={side} /> : null}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 214,
          translate: '-50% 0px',
          padding: '2px 18px 4px',
          borderRadius: 999,
          background: dark,
          border: `4px solid ${C.ink}`,
          color: '#fff',
          fontFamily: FONT_DISPLAY,
          fontSize: 26,
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </div>
    </div>
  );
};

/** 立ち絵（公式イラスト）。話している側が明るくなって弾み、もう一方は少し暗く沈む */
const STAND_W = 380;
const STAND_H = 440;
const IMG_H = 820;
const Standing: React.FC<{speaker: Speaker; src: string; line: FlatLine | undefined; side: 'left' | 'right'}> = ({speaker, src, line, side}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const isSpeaker = line?.speaker === speaker;
  const talking = Boolean(isSpeaker && line && frame >= line.start && frame < line.end);
  const since = line ? frame - line.start : 0;
  const emotion: Emotion = isSpeaker && line ? line.emotion : 'normal';
  const name = speaker === 'zundamon' ? 'ずんだもん' : '四国めたん';
  const dark = speaker === 'zundamon' ? C.zundamonDark : C.metanDark;
  // 喋り出しでぴょこっと跳ね、喋っている間は小さく上下する
  const hop = isSpeaker ? interpolate(since, [0, 4, 9], [0, -30, 0], clamp) : 0;
  const bob = talking ? -Math.abs(Math.sin((frame / fps) * Math.PI * 3.2)) * 7 : Math.sin(frame / 24) * 2;
  // 驚いたときは大きく跳ね、しょんぼりは少し沈む
  const extra = emotion === 'surprised' ? interpolate(since, [0, 5, 12], [0, -40, 0], clamp) : emotion === 'sad' ? 18 : 0;
  const scale = isSpeaker ? 1.04 : 0.97;
  return (
    <div
      style={{
        position: 'absolute',
        left: side === 'left' ? -10 : undefined,
        right: side === 'right' ? -10 : undefined,
        bottom: 0,
        width: STAND_W,
        height: STAND_H,
        overflow: 'visible',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: STAND_H + 60,
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Img
          src={staticFile(src)}
          style={{
            height: IMG_H,
            marginTop: 60,
            translate: `0px ${hop + bob + extra}px`,
            scale: String(scale),
            transformOrigin: 'top center',
            filter: isSpeaker || !line ? 'drop-shadow(0 0 0 #fff) drop-shadow(6px 0 0 #fff) drop-shadow(-6px 0 0 #fff) drop-shadow(0 -6px 0 #fff)' : 'brightness(0.62) saturate(0.7)',
          }}
        />
      </div>
      {isSpeaker ? (
        <div style={{position: 'absolute', top: 10, left: side === 'left' ? 230 : 40, width: 240, height: 200}}>
          <EmotionFx emotion={emotion} since={since} side={side} />
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 18,
          translate: '-50% 0px',
          padding: '2px 18px 4px',
          borderRadius: 999,
          background: dark,
          border: `4px solid ${C.ink}`,
          color: '#fff',
          fontFamily: FONT_DISPLAY,
          fontSize: 26,
          whiteSpace: 'nowrap',
          opacity: isSpeaker || !line ? 1 : 0.75,
        }}
      >
        {name}
      </div>
    </div>
  );
};

export const Characters: React.FC<{lines: FlatLine[]; images?: {zundamon: string; metan: string} | null}> = ({lines, images}) => {
  const frame = useCurrentFrame();
  const current = findLine(lines, frame);
  if (images) {
    return (
      <>
        <Standing speaker="metan" src={images.metan} line={current} side="left" />
        <Standing speaker="zundamon" src={images.zundamon} line={current} side="right" />
      </>
    );
  }
  return (
    <>
      <Character speaker="metan" line={current} side="left" />
      <Character speaker="zundamon" line={current} side="right" />
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
