# やらかした会社 — 解説動画制作パイプライン

YouTube 向け解説動画シリーズ「やらかした会社」を作るためのリポジトリ。
**回ごとに書き換えるのは `episodes/<回>/script.json` だけ**にする。Remotion のコンポーネントは再利用できる「シーン部品」として保つ。

> 同じリポジトリにある `地図アプリ/`、`brunch.md`、`test.md`、`.github/workflows/deploy-pinroute.yml` は別件のファイル。触らない。

## シリーズ方針

- 形式：ずんだもん（ツッコミ・素朴な質問役）と四国めたん（解説役）の掛け合い。音声は VOICEVOX
- 尺：1 本 6〜8 分
- 口調：面白おかしく。ただし**笑いの対象は出来事・数字・経営判断に限る**
- 構成の型：つかみ → 創業 → 絶頂 → やらかし（複数可） → その後 → 現在 → まとめ（教訓は 1 つだけ）
- 章の終わりに「やらかし度メーター」（`meter`）で針を上げる

## 守ること（必須）

1. **事実は必ず出典つき。** 優先順位は、一次情報（会社の IR 資料、適時開示、第三者委員会報告書、有価証券報告書） ＞ 報道（補強用）。出典を確認できない事実は台本に入れない
2. 推測や評価は「〜とされる」「報告書によれば」と書き分け、断定しない
3. **個人名は出さない。** 「当時の社長」など役職で書く（創業者・発明者など歴史上の人物は可）
4. 個人への揶揄、容姿や人格への言及はしない
5. 会社のロゴ、実在の人物の写真、アニメ・テレビ番組の画像、その他の他社素材は使わない。社名・番組名はテキストのみ。キャラクターも第三者のイラストは使わず、自作の図形（名前入りの丸アイコン）で描く
6. BGM ファイルは同梱しない。`script.json` の `bgm`（パスと音量）だけを用意し、ファイルは後から人間が入れる
7. `credits.json` に「VOICEVOX:ずんだもん」「VOICEVOX:四国めたん」を必ず入れる
8. YouTube への投稿はしない（人間が行う）

## ディレクトリ構成

```
CLAUDE.md                  この文書
package.json               パイプライン用のコマンド（npm run ...）
remotion/                  Remotion プロジェクト（シーン部品とメインのコンポジション）
  src/Root.tsx             コンポジション登録（id: "Episode"）
  src/Episode.tsx          timeline.json を受け取って全シーンを並べる
  src/scenes/*.tsx         シーン部品（title, timeline, bigNumber, barChart, transferMap, quote, meter）
  src/components/*.tsx     キャラクター、字幕、出典表示など共通部品
  src/types.ts             script.json / timeline.json の型（scripts/ からも参照）
scripts/
  check-script.ts          script.json の検査（出典 ID、数値の出典、字幕の長さ、個人名チェック用の禁止語）
  tts.ts                   セリフごとに VOICEVOX で wav を作り、長さを測る
  build-timeline.ts        wav の長さから timeline.json と narration.wav を作る
  render.ts                Remotion で out.mp4 を作り、映像のみ版 out_no_audio.mp4 も作る
  make-docs.ts             sources.md・credits.json の概要欄テキスト・読みやすい台本（script.md）を生成
  make.ts                  上の手順を順に全部実行
  studio.ts                Remotion Studio でプレビュー
  highlight.ts             見せ場だけをつないだサンプル動画（sample.mp4）
  make-sfx.ts              効果音を ffmpeg で合成（assets/sfx、第三者素材なし）
episodes/<NNN-company>/
  research.md              調べた事実と出典 URL（一次情報優先）
  script.json              台本（回ごとに書き換えるのはこれだけ）
  sources.md               動画内で使った事実と出典の対応表（make-docs.ts が生成）
  script.md                人間が読む用の台本（make-docs.ts が生成）
  credits.json             クレジットと YouTube 概要欄用テキスト（description.txt にも同じ内容）
  factcheck.md             事実確認サブエージェントの報告
  audio/                   セリフごとの wav と narration.wav（全セリフを 1 本にしたもの）
  timeline.json            各シーン・各セリフの開始フレームと長さ（build-timeline.ts が生成）
  out.mp4 / out_no_audio.mp4
.claude/agents/fact-checker.md   台本の事実確認を行うサブエージェント
.claude/skills/remotion-*        Remotion 公式 Agent Skills（npx skills add remotion-dev/skills）
```

## 制作の流れ

1. 調査：`research.md` に事実・数値・出典 URL を書く（ID は `src-NN`）
2. 台本：`script.json` を書く。各シーンの `facts` に「そのシーンで言っている事実」と `sourceIds` を書く
3. 検査：`npm run check -- episodes/<回>`
4. 事実確認：fact-checker サブエージェントに、台本を書いた流れとは**別のコンテキスト**で全事実を確認させ、指摘を直す
5. 人間の確認（台本・sources.md）
6. 音声：`npm run tts -- episodes/<回>`（VOICEVOX が `http://localhost:50021` で動いていること）
7. タイムライン：`npm run timeline -- episodes/<回>`
8. 書き出し：`npm run render -- episodes/<回>`
9. 文書：`npm run docs -- episodes/<回>`（sources.md・script.md・概要欄テキスト）

見せ場だけのサンプル動画は `npm run sample -- episodes/<回>`（`--clips=ch0-s1:0-6,ch5-s2:12-24` で場面と秒を指定）。
一括実行は `npm run make -- episodes/<回>`（`--silent` で VOICEVOX なしの通し確認、`--no-render` で書き出し以外）。
プレビューは `npm run studio -- episodes/<回>`。確認用の静止画は `npm run stills -- episodes/<回>`（`--stills=ch5-s2@last,ch7-s3@2` のように、シーンと何番目のセリフかを指定できる）。

### 書き出し環境のメモ

- Remotion は初回に専用ブラウザ（Chrome Headless Shell）を remotion.media から取得する。取得できない環境では、環境変数 `REMOTION_BROWSER_EXECUTABLE` にブラウザのパスを入れると、それを使う（このクラウド環境では `/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`）
- 1080p・30fps で、4 コアのマシンなら 1 秒あたり 15 フレーム前後（8 分の動画で 15 分ほど）

## script.json の書き方（要点）

- `chapters[].scenes[]` に `visual`（`title | timeline | bigNumber | barChart | transferMap | quote | meter`）と `lines` を書く
- `lines[].text` は字幕にそのまま出る。読み間違いが心配な語は `yomi` に読み（カタカナ・ひらがな）を書くと、音声だけそちらを使う
- 字幕は 1 セリフ 60 文字以内を目安（2 行に収まる）。長いときは分ける
- 数値・日付を言うシーンには必ず `sourceIds` と `facts` を付ける（`check-script.ts` が検査する）
- 個人名を入れない。経営者は「当時の社長」などと書く

## VOICEVOX

- エンジン：`http://localhost:50021`。起動例：`docker run --rm -p 50021:50021 voicevox/voicevox_engine:cpu-latest`
- 話者 ID は `/speakers` から名前とスタイル名（ずんだもん／ノーマル、四国めたん／ノーマル）で引く
- エンジンが使えないときは `npm run tts -- episodes/<回> --silent`（文字数から尺を見積もった無音 wav で代用）。この場合は動画に音声が入らないので、本番前に必ず作り直す
- 利用規約に従い、クレジット「VOICEVOX:ずんだもん」「VOICEVOX:四国めたん」を概要欄に記載する

## Remotion

- `.claude/skills/` の公式スキル（remotion-best-practices ほか）の作法に従う：アニメーションは `useCurrentFrame()` と `interpolate()`、CSS アニメーションは使わない、秒→フレームは `useVideoConfig().fps` から
- シーン部品は `timeline.json` から生成されるデータ駆動の部品なので、Studio 上での個別編集の対象にはしていない（内容は script.json 側で直す）
- フォントは npm の Fontsource（M PLUS Rounded 1c、Dela Gothic One、どちらも OFL）。動画で使う全文字を最初に読み込んでから描画する
- Remotion は従業員 4 名以上の企業での利用に有料ライセンスが必要（`remotion-license` スキル参照）
