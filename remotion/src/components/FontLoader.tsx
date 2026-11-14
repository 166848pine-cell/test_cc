import '@fontsource/m-plus-rounded-1c/500.css';
import '@fontsource/m-plus-rounded-1c/800.css';
import '@fontsource/dela-gothic-one/400.css';
import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';

/**
 * 日本語フォントは文字ごとに分割されたファイル（unicode-range）なので、
 * 動画で使う全文字を最初に読み込んでから描画を始める。
 */
export const FontLoader: React.FC<{text: string}> = ({text}) => {
  const [handle] = useState(() => delayRender('日本語フォントの読み込み'));
  useEffect(() => {
    const sample = text || 'あ';
    Promise.all([
      document.fonts.load(`500 40px "M PLUS Rounded 1c"`, sample),
      document.fonts.load(`800 40px "M PLUS Rounded 1c"`, sample),
      document.fonts.load(`400 40px "Dela Gothic One"`, sample),
    ])
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch((err) => {
        console.error(err);
        continueRender(handle);
      });
  }, [handle, text]);
  return null;
};
