import {COUNT_END_SEC, METER_BREAK_SEC, revealFrame, staggered} from './timing';
import type {Timeline} from './types';

export type SfxName = 'don' | 'pikon' | 'jan' | 'shu' | 'boyon';
export type SfxEvent = {frame: number; name: SfxName; volume: number};

/** 画面の動きに合わせた効果音の一覧（シーン部品のタイミングと同じ計算） */
export function sfxEvents(timeline: Timeline): SfxEvent[] {
  const fps = timeline.fps;
  const out: SfxEvent[] = [];
  const add = (frame: number, name: SfxName, volume = 1) => out.push({frame: Math.max(0, Math.round(frame)), name, volume});
  timeline.scenes.forEach((s, i) => {
    const at = (f: number) => s.from + f;
    const prev = timeline.scenes[i - 1];
    const v = s.visual;
    if (v.type === 'title') add(at(2), 'jan', 0.8);
    else if (!prev || prev.visual.type === 'title') add(at(0), 'shu', 0.7);
    if (s.stamp) add(at(revealFrame(s, s.stamp.atLine, 0, 1) + 4), 'don', 1);
    switch (v.type) {
      case 'bigNumber':
        add(at(v.props.countToOku !== undefined ? Math.round(COUNT_END_SEC * fps) : 4), 'don', 0.8);
        if (v.props.conversion) add(at(revealFrame(s, v.props.conversion.atLine, 0, 1)), 'pikon', 0.7);
        break;
      case 'timeline':
        staggered(s, v.props.items).forEach((f) => add(at(f), 'pikon', 0.45));
        break;
      case 'transferMap':
        staggered(s, v.props.items).forEach((f) => {
          add(at(f), 'shu', 0.5);
          add(at(f + 8), 'don', 0.45);
        });
        break;
      case 'barChart': {
        const normal = v.props.bars.filter((b) => !v.props.highlight?.includes(b.label)).length;
        if (v.props.highlight?.length) add(at(10 + normal * 4 + 12), 'shu', 0.8);
        break;
      }
      case 'quote':
        add(at(6), 'shu', 0.5);
        break;
      case 'meter':
        add(at(8), 'shu', 0.6);
        if (v.props.level > 100) {
          add(at(8 + Math.round(METER_BREAK_SEC * fps)), 'don', 1);
          add(at(8 + Math.round(METER_BREAK_SEC * fps) + 2), 'boyon', 0.8);
        }
        break;
    }
  });
  return out.sort((a, b) => a.frame - b.frame);
}
