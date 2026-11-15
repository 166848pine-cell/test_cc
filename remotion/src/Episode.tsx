import {Audio} from '@remotion/media';
import {useMemo} from 'react';
import {AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Characters, type FlatLine} from './components/Characters';
import {Background, Board, Header, SourceFooter} from './components/Chrome';
import {Stamp} from './components/Fx';
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
import {sfxEvents} from './sfx';
import {revealFrame} from './timing';
import type {Timeline, TimelineScene as TScene} from './types';

/** visual.type に応じたシーン部品を選ぶ */
const SceneVisual: React.FC<{scene: TScene}> = ({scene}) => {
  const v = scene.visual;
  switch (v.type) {
    case 'title':
      return <TitleScene scene={scene} props={v.props} />;
    case 'timeline':
      return <TimelineScene scene={scene} props={v.props} />;
    case 'bigNumber':
      return <BigNumberScene scene={scene} props={v.props} />;
    case 'barChart':
      return <BarChartScene scene={scene} props={v.props} />;
    case 'transferMap':
      return <TransferMapScene scene={scene} props={v.props} />;
    case 'quote':
      return <QuoteScene scene={scene} props={v.props} />;
    case 'meter':
      return <MeterScene scene={scene} props={v.props} />;
  }
};

/** BGM。セリフの間は音量を下げ（ダッキング）、頭と終わりはフェードする */
const BgmTrack: React.FC<{src: string; volume: number; lines: FlatLine[]; total: number}> = ({src, volume, lines, total}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // いま喋っているか（前後 6 フレームでなめらかに）
  let speech = 0;
  for (const l of lines) {
    if (l.start - 6 > frame) break;
    if (frame <= l.end + 6) speech = Math.max(speech, interpolate(frame, [l.start - 6, l.start, l.end, l.end + 6], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  }
  const duck = 1 - 0.45 * speech;
  const fade = interpolate(frame, [0, fps, total - 2 * fps, total], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <Audio name="BGM" src={staticFile(src)} volume={volume * duck * fade} loop />;
};

/** シーンごとのハンコ（フリップの右上に押される） */
const SceneStamp: React.FC<{scene: TScene}> = ({scene}) => {
  if (!scene.stamp) return null;
  // 図の種類ごとに、中身と重ならない位置に押す
  const pos: Record<string, React.CSSProperties> = {
    bigNumber: {right: 70, top: 96, scale: '0.78'},
    barChart: {right: 640, top: 150},
    transferMap: {right: 20, top: 610, scale: '0.62'},
    timeline: {right: 90, top: 128},
  };
  return <Stamp text={scene.stamp.text} start={revealFrame(scene, scene.stamp.atLine, 0, 1) + 4} style={pos[scene.visual.type] ?? {right: 110, top: 130}} />;
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
      <AbsoluteFill style={{backgroundColor: C.stage, alignItems: 'center', justifyContent: 'center', fontFamily: FONT_BODY, fontSize: 48, color: '#fff'}}>
        timeline.json を --props で渡してください（npm run studio -- episodes/＜回＞）
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{backgroundColor: C.stage}}>
      <FontLoader text={timeline.fontText} />
      <Background timeline={timeline} />
      <Board timeline={timeline} />
      {timeline.scenes.map((s) => (
        <Sequence key={s.id} name={s.id} from={s.from} durationInFrames={s.durationInFrames} layout="none">
          <SceneVisual scene={s} />
          <SceneStamp scene={s} />
        </Sequence>
      ))}
      <Header timeline={timeline} />
      <Characters lines={lines} />
      <Subtitle lines={lines} />
      <SourceFooter timeline={timeline} />
      {timeline.narration ? <Audio name="ナレーション" src={staticFile(timeline.narration.src)} /> : null}
      {timeline.bgm ? <BgmTrack src={timeline.bgm.src} volume={timeline.bgm.volume} lines={lines} total={timeline.durationInFrames} /> : null}
      {timeline.sfx
        ? sfxEvents(timeline).map((e, i) => (
            <Sequence key={`sfx-${i}`} name={`効果音 ${e.name}`} from={e.frame} durationInFrames={timeline.fps} layout="none">
              <Audio src={staticFile(`sfx/${e.name}.wav`)} volume={e.volume * (timeline.sfx?.volume ?? 0.5)} />
            </Sequence>
          ))
        : null}
    </AbsoluteFill>
  );
};
