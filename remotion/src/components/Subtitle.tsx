import {interpolate, useCurrentFrame} from 'remotion';
import {C, FONT_BODY, LAYOUT} from '../theme';
import {clamp} from '../timing';
import {findLine, type FlatLine} from './Characters';

const BOX_TEXT_W = 1290;
const MAX_FONT = 50;

/** 字幕を 1〜2 行に分ける。句読点・かぎかっこの切れ目のうち、真ん中に近い所で改行する */
export function splitSubtitle(text: string): string[] {
  const chars = [...text.trim()];
  if (chars.length * MAX_FONT <= BOX_TEXT_W) return [chars.join('')];
  const mid = chars.length / 2;
  const isKana = (c: string | undefined) => !!c && /[ぁ-ゖー]/.test(c);
  let best = Math.round(mid);
  let bestScore = Infinity;
  let depth = 0;
  for (let cut = 1; cut < chars.length; cut++) {
    const prev = chars[cut - 1];
    const next = chars[cut];
    if ('「『（'.includes(prev)) depth++;
    if ('」』）'.includes(prev)) depth = Math.max(0, depth - 1);
    if ('」』）、。…！？!?'.includes(next)) continue; // 行頭に閉じかっこ・句読点を置かない
    let penalty: number | null = null;
    if ('、。！？!?」』）…'.includes(prev) || next === ' ') penalty = 0;
    else if ('「『（'.includes(next)) penalty = 1;
    else if ('はをがでにのともへ'.includes(prev) && !isKana(next)) penalty = 4;
    if (penalty === null) continue;
    if (depth > 0) penalty += 8; // かぎかっこの中では切らない
    const score = Math.abs(cut - mid) + penalty;
    if (score < bestScore) {
      bestScore = score;
      best = cut;
    }
  }
  return [chars.slice(0, best).join('').trim(), chars.slice(best).join('').trim()];
}

export const Subtitle: React.FC<{lines: FlatLine[]}> = ({lines}) => {
  const frame = useCurrentFrame();
  const line = findLine(lines, frame);
  if (!line) return null;
  const color = line.speaker === 'zundamon' ? C.zundamon : C.metan;
  const name = line.speaker === 'zundamon' ? 'ずんだもん' : '四国めたん';
  const rows = splitSubtitle(line.text);
  const longest = Math.max(...rows.map((r) => [...r].length));
  const fontSize = Math.min(MAX_FONT, Math.floor(BOX_TEXT_W / longest));
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
            whiteSpace: 'nowrap',
          }}
        >
          {rows.map((r, i) => (
            <div key={i}>{r}</div>
          ))}
        </div>
      </div>
    </div>
  );
};
