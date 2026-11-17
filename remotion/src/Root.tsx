import {Composition, Still, type CalculateMetadataFunction} from 'remotion';
import {CharacterSheet} from './CharacterSheet';
import {Episode} from './Episode';
import type {Timeline} from './types';

// 尺・fps・サイズは timeline.json（--props で渡す）から決まる
const calculateMetadata: CalculateMetadataFunction<Timeline> = ({props}) => {
  return {
    durationInFrames: Math.max(1, props.durationInFrames),
    fps: props.fps,
    width: props.width,
    height: props.height,
    defaultOutName: `episode-${String(props.episode).padStart(3, '0')}`,
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Still id="CharacterSheet" component={CharacterSheet} width={1920} height={1080} />
    <Composition
      id="Episode"
      component={Episode}
      durationInFrames={90}
      fps={30}
      width={1920}
      height={1080}
      calculateMetadata={calculateMetadata}
      defaultProps={{
        version: 1,
        fps: 30,
        width: 1920,
        height: 1080,
        series: 'やらかした会社',
        episode: 0,
        title: '',
        durationInFrames: 90,
        audioMode: 'silent',
        narration: null,
        bgm: null,
        sfx: null,
        characters: null,
        sources: {},
        fontText: '',
        scenes: [],
      }}
    />
    </>
  );
};
