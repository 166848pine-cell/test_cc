import {Audio} from '@remotion/media';
import {useMemo} from 'react';
import {AbsoluteFill, Sequence, staticFile} from 'remotion';
import {Characters, type FlatLine} from './components/Characters';
import {Background, Header, SourceFooter} from './components/Chrome';
import {FontLoader} from './components/FontLoader';
import {Subtitle} from './components/Subtitle';
import {BarChartScene} from './scenes/BarChartScene';
import {BigNumberScene} from './scenes/BigNumberScene';
import {MeterScene} from './scenes/MeterScene';
import {QuoteScene} from './scenes/QuoteScene';
import {TimelineScene} from './scenes/TimelineScene';
import {TitleScene} from './scenes/TitleScene';
import {TransferMapScene} from './scenes/TransferMapScene';
import {C, FONT_BODY} from './theme';
import type {Timeline, TimelineScene as TScene} from './types';

/** visual.type に応じたシーン部品を選ぶ */
const SceneVisual: React.FC<{scene: TScene}> = ({scene}) => {
  const v = scene.visual;
  switch (v.type) {
    case 'title':
      return <TitleScene props={v.props} />;
    case 'timeline':
      return <TimelineScene scene={scene} props={v.props} />;
    case 'bigNumber':
      return <BigNumberScene scene={scene} props={v.props} />;
    case 'barChart':
      return <BarChartScene props={v.props} />;
    case 'transferMap':
      return <TransferMapScene scene={scene} props={v.props} />;
    case 'quote':
      return <QuoteScene props={v.props} />;
    case 'meter':
      return <MeterScene props={v.props} />;
  }
};

/**
 * 1 本の動画。timeline.json（build-timeline.ts が作る）をそのまま props として受け取る。
 * シーンの中身・順番・尺は script.json と音声の長さから決まるので、Studio 上では編集しない。
 */
export const Episode: React.FC<Timeline> = (timeline) => {
  const lines = useMemo<FlatLine[]>(() => {
    const out: FlatLine[] = [];
    for (const s of timeline.scenes) {
      s.lines.forEach((l, i) => {
        const start = s.from + l.from;
        const next = s.lines[i + 1];
        out.push({
          id: l.id,
          speaker: l.speaker,
          text: l.text,
          emotion: l.emotion ?? 'normal',
          start,
          end: start + l.durationInFrames,
          holdUntil: next ? s.from + next.from : s.from + s.durationInFrames,
        });
      });
    }
    return out;
  }, [timeline.scenes]);

  if (timeline.scenes.length === 0) {
    return (
      <AbsoluteFill style={{backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', fontFamily: FONT_BODY, fontSize: 48, color: C.ink}}>
        timeline.json を --props で渡してください（npm run studio -- episodes/＜回＞）
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <FontLoader text={timeline.fontText} />
      <Background />
      {timeline.scenes.map((s) => (
        <Sequence key={s.id} name={s.id} from={s.from} durationInFrames={s.durationInFrames} layout="none">
          <SceneVisual scene={s} />
        </Sequence>
      ))}
      <Header timeline={timeline} />
      <Characters lines={lines} />
      <Subtitle lines={lines} />
      <SourceFooter timeline={timeline} />
      {timeline.narration ? <Audio name="ナレーション" src={staticFile(timeline.narration.src)} /> : null}
      {timeline.bgm ? <Audio name="BGM" src={staticFile(timeline.bgm.src)} volume={timeline.bgm.volume} loop /> : null}
    </AbsoluteFill>
  );
};
