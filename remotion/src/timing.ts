import {Easing, interpolate, spring} from 'remotion';
import type {TimelineScene} from './types';

/** シーン内で atLine 番目のセリフが始まるフレーム（未指定なら均等に配置） */
export function revealFrame(scene: TimelineScene, atLine: number | undefined, index: number, count: number): number {
  if (atLine !== undefined && scene.lines[atLine]) return scene.lines[atLine].from;
  const span = Math.max(1, scene.durationInFrames * 0.6);
  return Math.round(8 + (span * index) / Math.max(1, count));
}

/** 同じタイミングに出る要素を少しずつずらす */
export function staggered<T extends {atLine?: number}>(scene: TimelineScene, items: T[]): number[] {
  const seen = new Map<number, number>();
  return items.map((it, i) => {
    const base = revealFrame(scene, it.atLine, i, items.length);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return base + n * 8;
  });
}

/** 大きな数字のカウントアップが着地するまでの秒数 */
export const COUNT_END_SEC = 1.1;
/** メーターが振り切れるまでの秒数（針が動き出してから） */
export const METER_BREAK_SEC = 0.6;

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** 0→1 の入場（ふわっと） */
export const enter = (frame: number, start: number, fps: number, damping = 14) =>
  spring({frame: frame - start, fps, config: {damping, mass: 0.6}});

export const fadeIn = (frame: number, start: number, len = 8) =>
  interpolate(frame, [start, start + len], [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
