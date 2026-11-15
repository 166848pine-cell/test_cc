import {interpolate, useCurrentFrame} from 'remotion';
import {C, FONT_BODY, LAYOUT, parseMarks} from '../theme';
import {clamp} from '../timing';
import {findLine, type FlatLine} from './Characters';

const BOX_TEXT_W = 1240;
const MAX_FONT = 58;

/** 字幕を 1〜2 行に分ける位置（強調記号を除いた文字数で数える）。分けないときは -1 */
export function splitPoint(plain: string): number {
  const chars = [...plain.trim()];
  if (chars.length * MAX_FONT <= BOX_TEXT_W) return -1;
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
  return best;
}

/** {強調} 記法を保ったまま 1〜2 行に分ける */
export function splitMarked(text: string): string[] {
  const plain = text.replace(/[{}]/g, '').trim();
  const cut = splitPoint(plain);
  if (cut < 0) return [text.trim()];
  const chars = [...text.trim()];
  let count = 0;
  let inEm = false;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === '{') inEm = true;
    else if (c === '}') inEm = false;
    else {
      if (count === cut) {
        const a = chars.slice(0, i).join('') + (inEm ? '}' : '');
        const b = (inEm ? '{' : '') + chars.slice(i).join('');
        return [a.trim(), b.trim()];
      }
      count++;
    }
  }
  return [text.trim()];
}

/** 縁取りテロップの字幕。強調部分は黄色 */
export const Subtitle: React.FC<{lines: FlatLine[]}> = ({lines}) => {
  const frame = useCurrentFrame();
  const line = findLine(lines, frame);
  if (!line) return null;
  const color = line.speaker === 'zundamon' ? C.zundamonDark : C.metanDark;
  const rows = splitMarked(line.text);
  const longest = Math.max(...rows.map((r) => [...r.replace(/[{}]/g, '')].length));
  const fontSize = Math.min(MAX_FONT, Math.floor(BOX_TEXT_W / longest));
  const t = frame - line.start;
  return (
    <div
      style={{
        position: 'absolute',
        left: 300,
        width: 1320,
        top: LAYOUT.bottomTop + 34,
        height: 230,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_BODY,
        fontWeight: 800,
        fontSize,
        lineHeight: 1.32,
        whiteSpace: 'nowrap',
        scale: String(interpolate(t, [0, 3, 6], [0.92, 1.03, 1], clamp)),
        opacity: interpolate(t, [0, 2], [0.4, 1], clamp),
      }}
    >
      {rows.map((r, i) => {
        const segs = parseMarks(r);
        const layers = [
          (em: boolean) => ({color: C.ink, WebkitTextStroke: `22px ${C.ink}`}),
          (em: boolean) => ({color: em ? C.red : color, WebkitTextStroke: `12px ${em ? C.red : color}`}),
        ];
        const row = (style: (em: boolean) => React.CSSProperties) =>
          segs.map((seg, j) => (
            <span key={j} style={{fontSize: seg.em ? fontSize * 1.06 : fontSize, ...style(seg.em)}}>
              {seg.t}
            </span>
          ));
        return (
          <div key={i} style={{position: 'relative'}}>
            {layers.map((l, k) => (
              <div key={k} aria-hidden style={{position: 'absolute', inset: 0}}>
                {row(l)}
              </div>
            ))}
            <div style={{position: 'relative'}}>{row((em) => ({color: em ? C.yellow : '#fff'}))}</div>
          </div>
        );
      })}
    </div>
  );
};
