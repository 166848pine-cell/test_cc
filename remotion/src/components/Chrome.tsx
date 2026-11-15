import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT_BODY, FONT_DISPLAY, LAYOUT, shade, withAlpha} from '../theme';
import {clamp} from '../timing';
import type {Timeline, TimelineScene} from '../types';
import {Outlined} from './Fx';

export function sceneIndexAt(scenes: TimelineScene[], frame: number): number {
  let lo = 0;
  let hi = scenes.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (scenes[mid].from <= frame) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

export const currentScene = (scenes: TimelineScene[], frame: number): TimelineScene | undefined => scenes[sceneIndexAt(scenes, frame)];

const isFullTitle = (s: TimelineScene | undefined) => s?.visual.type === 'title';

/** 暗い舞台＋流れる斜線＋章の色の光 */
export const Background: React.FC<{timeline: Timeline}> = ({timeline}) => {
  const frame = useCurrentFrame();
  const scene = currentScene(timeline.scenes, frame);
  const accent = scene?.accent ?? C.yellow;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.stage,
        backgroundImage: `radial-gradient(circle at 50% 38%, ${withAlpha(accent, 0.28)} 0%, transparent 62%), repeating-linear-gradient(-45deg, ${C.stageLine} 0px, ${C.stageLine} 26px, transparent 26px, transparent 52px)`,
        backgroundPosition: `0 0, ${(frame * 0.8) % 73.5}px 0`,
      }}
    />
  );
};

/** 中央のフリップ（扉の場面では隠れる） */
export const Board: React.FC<{timeline: Timeline}> = ({timeline}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const i = sceneIndexAt(timeline.scenes, frame);
  const scene = timeline.scenes[i];
  if (!scene || isFullTitle(scene)) return null;
  const prev = timeline.scenes[i - 1];
  const t = frame - scene.from;
  const enter = !prev || isFullTitle(prev) ? interpolate(t, [0, 0.35 * fps], [0, 1], {...clamp, easing: (x) => 1 - Math.pow(1 - x, 3)}) : 1;
  return (
    <div
      style={{
        position: 'absolute',
        left: LAYOUT.boardLeft,
        top: LAYOUT.boardTop,
        width: LAYOUT.boardWidth,
        height: LAYOUT.boardHeight,
        background: C.board,
        borderRadius: 26,
        border: `6px solid ${C.ink}`,
        boxShadow: `14px 14px 0 ${scene.accent}`,
        translate: `0px ${interpolate(enter, [0, 1], [700, 0])}px`,
        rotate: `${interpolate(enter, [0, 1], [4, 0])}deg`,
        boxSizing: 'border-box',
      }}
    >
      {/* 角のマスキングテープ */}
      <div style={{position: 'absolute', left: -26, top: 20, width: 120, height: 34, background: withAlpha(scene.accent, 0.75), rotate: '-32deg'}} />
      <div style={{position: 'absolute', right: -26, top: 20, width: 120, height: 34, background: withAlpha(scene.accent, 0.75), rotate: '32deg'}} />
    </div>
  );
};

/** 上端：シリーズのロゴと章 */
export const Header: React.FC<{timeline: Timeline}> = ({timeline}) => {
  const frame = useCurrentFrame();
  const scene = currentScene(timeline.scenes, frame);
  if (!scene) return null;
  const file = scene.chapterIndex > 0 ? `FILE.${String(scene.chapterIndex).padStart(2, '0')}` : 'OPENING';
  return (
    <div style={{position: 'absolute', left: 36, right: 36, top: 18, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <div
          style={{
            padding: '6px 22px 8px',
            borderRadius: 12,
            background: `repeating-linear-gradient(-45deg, ${C.yellow} 0 18px, ${C.ink} 18px 36px)`,
            border: `4px solid ${C.ink}`,
            rotate: '-2deg',
          }}
        >
          <Outlined strokes={[{w: 6, color: C.ink}]} style={{fontFamily: FONT_DISPLAY, fontSize: 34, lineHeight: 1}}>
            {timeline.series}
          </Outlined>
        </div>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 30, color: C.yellow}}>#{timeline.episode}</div>
      </div>
      <div style={{display: 'flex', alignItems: 'stretch', borderRadius: 999, overflow: 'hidden', border: `4px solid ${C.ink}`, boxShadow: `0 0 0 3px ${scene.accent}`}}>
        <div style={{background: C.ink, color: scene.accent, fontFamily: FONT_DISPLAY, fontSize: 24, padding: '8px 16px', display: 'flex', alignItems: 'center'}}>{file}</div>
        <div style={{background: scene.accent, color: C.ink, fontFamily: FONT_BODY, fontWeight: 800, fontSize: 30, padding: '4px 24px'}}>{scene.chapterTitle}</div>
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
  const MAX_CHARS = 80;
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
        left: 300,
        right: 300,
        top: LAYOUT.footerY,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_BODY,
        fontWeight: 500,
        fontSize: 19,
        color: C.footer,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        opacity: interpolate(frame - scene.from, [0, 10], [0, 1], clamp),
      }}
    >
      <span style={{background: shade(C.stage, 0.08), padding: '2px 14px', borderRadius: 8, overflow: 'hidden', textOverflow: 'ellipsis'}}>{text}</span>
    </div>
  );
};
