import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const STANDALONE_DIR = 'dist-standalone';
const STANDALONE_FILE = 'PinRoute.html';

/**
 * JSとCSSをすべて埋め込んだ1ファイル版 `dist/PinRoute.html` を作る。
 *
 * ブラウザは file:// で開いたページから別ファイルのスクリプトやCSSを読み込むことを
 * CORSで禁止している。そのため `dist/index.html` をダブルクリックしても動かない。
 * 中身を1枚のHTMLに畳んでおけば、サーバーを立てずにそのまま開ける。
 */
function standaloneHtml(): Plugin {
  return {
    name: 'pinroute-standalone',
    apply: 'build',
    closeBundle() {
      const from = resolve(__dirname, STANDALONE_DIR);
      const indexPath = resolve(from, 'index.html');
      if (!existsSync(indexPath)) return;
      let html = readFileSync(indexPath, 'utf-8');

      // <script ... src="./assets/xxx.js"></script> を取り除き、中身を </body> の直前に置く。
      // モジュールと違い通常のスクリプトは即時実行されるため、head に残すとDOMより先に動いてしまう。
      const scripts: string[] = [];
      html = html.replace(
        /<script[^>]*src="\.?\/?([^"]+\.js)"[^>]*><\/script>/g,
        (_m, file: string) => {
          const code = readFileSync(resolve(from, file), 'utf-8');
          scripts.push(
            `<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`,
          );
          return '';
        },
      );
      // 置換文字列を直接渡すと、JS中の `$&` などが置換パターンとして展開されて壊れる。
      // 必ず関数で返すこと。
      html = html.replace('</body>', () => `${scripts.join('\n')}\n</body>`);

      // <link rel="stylesheet" href="./assets/xxx.css"> を中身に置き換える
      html = html.replace(
        /<link[^>]*rel="stylesheet"[^>]*href="\.?\/?([^"]+\.css)"[^>]*>/g,
        (_m, file: string) => {
          const css = readFileSync(resolve(from, file), 'utf-8');
          return `<style>${css}</style>`;
        },
      );

      writeFileSync(resolve(__dirname, 'dist', STANDALONE_FILE), html, 'utf-8');
      rmSync(from, { recursive: true, force: true });
    },
  };
}

/**
 * 既定のビルド: GitHub Pages にそのまま置ける `dist/`
 * `--mode standalone`: 上記に加えて1ファイル版 `dist/PinRoute.html` を作る
 */
export default defineConfig(({ mode }) => {
  if (mode !== 'standalone') return { base: './' };
  return {
    base: './',
    plugins: [standaloneHtml()],
    build: {
      outDir: STANDALONE_DIR,
      emptyOutDir: true,
      // 1ファイルに畳めるよう、モジュールではなく従来型のスクリプトとして出力する
      rollupOptions: {
        output: { format: 'iife', inlineDynamicImports: true },
      },
    },
  };
});
