import {AbsoluteFill} from 'remotion';
import {ChibiFigure, type Mouth} from './components/Chibi';
import type {Emotion, Speaker} from './types';

/** 立ち絵の確認用（表情と口の差分を並べる） */
export const CharacterSheet: React.FC = () => {
  const rows: {speaker: Speaker; items: {emotion: Emotion; mouth: Mouth; blink?: boolean; label: string}[]}[] = (['zundamon', 'metan'] as Speaker[]).map((speaker) => ({
    speaker,
    items: [
      {emotion: 'normal', mouth: 0, label: '通常'},
      {emotion: 'normal', mouth: 2, label: '口パク'},
      {emotion: 'normal', mouth: 0, blink: true, label: 'まばたき'},
      {emotion: 'surprised', mouth: 3, label: '驚き'},
      {emotion: 'sad', mouth: 0, label: 'しょんぼり'},
      {emotion: 'happy', mouth: 2, label: 'うれしい'},
    ],
  }));
  return (
    <AbsoluteFill style={{background: '#EEF1F5', padding: 20, display: 'flex', flexDirection: 'column', gap: 10}}>
      {rows.map((r) => (
        <div key={r.speaker} style={{display: 'flex', gap: 6}}>
          {r.items.map((it, i) => (
            <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <ChibiFigure speaker={r.speaker} emotion={it.emotion} mouth={it.mouth} blink={!!it.blink} width={300} />
              <div style={{fontSize: 24, fontFamily: 'sans-serif'}}>{it.label}</div>
            </div>
          ))}
        </div>
      ))}
    </AbsoluteFill>
  );
};
