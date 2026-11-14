import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C, FONT_BODY, FONT_DISPLAY, LAYOUT} from '../theme';
import {clamp} from '../timing';
import type {Timeline, TimelineScene} from '../types';

/** 方眼の紙の背景 */
export const Background: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: C.bg,
      backgroundImage: `linear-gradient(${C.bgGrid} 2px, transparent 2px), linear-gradient(90deg, ${C.bgGrid} 2px, transparent 2px)`,
      backgroundSize: '48px 48px',
    }}
  >
    <div style={{position: 'absolute', left: 0, right: 0, top: LAYOUT.bottomTop, bottom: 0, background: 'rgba(255,255,255,0.55)', borderTop: `3px solid ${C.line}`}} />
  </AbsoluteFill>
);

export function currentScene(scenes: TimelineScene[], frame: number): TimelineScene | undefined {
  let lo = 0;
  let hi = scenes.length - 1;
  let found: TimelineScene | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (scenes[mid].from <= frame) {
      found = scenes[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** 上端：シリーズ名と章 */
export const Header: React.FC<{timeline: Timeline}> = ({timeline}) => {
  const frame = useCurrentFrame();
  const scene = currentScene(timeline.scenes, frame);
  if (!scene) return null;
  return (
    <div style={{position: 'absolute', left: 40, right: 40, top: 26, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 32, color: '#fff', background: C.accent, padding: '4px 18px', borderRadius: 10, rotate: '-2deg'}}>
          {timeline.series}
        </div>
        <div style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 28, color: C.inkSoft}}>#{timeline.episode}</div>
      </div>
      <div style={{fontFamily: FONT_BODY, fontWeight: 800, fontSize: 30, color: C.ink, background: C.card, border: `3px solid ${C.ink}`, borderRadius: 999, padding: '4px 22px'}}>
        {scene.chapterTitle}
      </div>
    </div>
  );
};

/** 下端：そのシーンの出典（sourceIds から自動表示） */
export const SourceFooter: React.FC<{timeline: Timeline}> = ({timeline}) => {
  const frame = useCurrentFrame();
  const scene = currentScene(timeline.scenes, frame);
  if (!scene || scene.sourceIds.length === 0) return null;
  const labels = scene.sourceIds.map((id) => timeline.sources[id]?.short ?? id);
  const MAX_CHARS = 96;
  const shown: string[] = [];
  let used = 0;
  for (const l of labels) {
    if (used + l.length > MAX_CHARS && shown.length > 0) break;
    shown.push(l);
    used += l.length + 3;
  }
  const rest = labels.length - shown.length;
  const text = `出典：${shown.join(' ／ ')}${rest > 0 ? ` ほか${rest}件（概要欄に一覧）` : ''}`;
  return (
    <div
      style={{
        position: 'absolute',
        left: 40,
        right: 40,
        top: LAYOUT.footerY,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        fontFamily: FONT_BODY,
        fontWeight: 500,
        fontSize: 21,
        color: C.inkSoft,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        opacity: interpolate(frame - scene.from, [0, 10], [0, 1], clamp),
      }}
    >
      {text}
    </div>
  );
};
