# 引き継ぎ書：解説動画シリーズ「やらかした会社」第1回（東芝）

最終更新：2026-11-17（クラウドの Claude Code セッションから、ローカルの Claude Code セッションへ引き継ぐために作成）

> **ローカルの Claude へ**：まずこの文書と `CLAUDE.md` を読んでください。この文書の「1. いまの状態」と「2. ユーザーの判断待ち」に、次にやることがまとまっています。

---

## 0. 基本情報

| 項目 | 内容 |
|---|---|
| リポジトリ | `166848pine-cell/test_cc` |
| 作業ブランチ | `claude/vibrant-heisenberg-pysqwe`（main にはまだマージしていない。PR も未作成） |
| 対象 | `episodes/001-toshiba/`（第1回 東芝「売った子どもに養われる親 ― 東芝150年のやらかし史」） |
| 同居している別件 | `地図アプリ/`、`brunch.md`、`test.md`、`.github/workflows/deploy-pinroute.yml` は無関係。触らない |
| シリーズの方針・守ること | `CLAUDE.md`（必読。事実の出典、個人名を出さない、他社素材を使わない、など） |

---

## 1. いまの状態（ひとことで）

- パイプラインは一通り動く：調査 → 台本（script.json）→ 事実確認 → VOICEVOX で音声 → タイムライン → Remotion で書き出し → 文書（出典表・字幕・概要欄）。
- **完成版の動画は一度書き出した**（`out.mp4` 7分44秒）。ただしこれは古い版。その後、次の変更を入れていて、**最新状態での書き出しはまだしていない**。
  1. 語り口を「批判」ではなく「解説」寄りに調整（規約対応）
  2. キャラクターを丸アイコン → 立ち絵に変更
- ユーザーの最新の評価は「ダサい・古っぽい」（背景とテロップ）と「キャラがイマイチ」。そのため、**見た目の方向と立ち絵素材の2点が、ユーザーの判断待ち**で止まっている（次の章）。

---

## 2. ユーザーの判断待ち（最優先）

### 2-1. 立ち絵の素材（ユーザーが用意する）

- ユーザーの要望は「よく使われている立ち絵と同じ感じにしたい」。坂本アヒルさん等の二次創作立ち絵（PSD、部品分け済み）のことです。
- クラウド側では取得できなかった。理由は2つ：ニコニコ静画・BOOTH はダウンロードにログインが必要、クラウドのネットワーク方針でもつながらない。
- **ユーザーにお願いしていること**：
  1. ニコニコ静画か BOOTH で立ち絵（PSD 入りの zip）をダウンロードする
  2. 配布ページの利用規約（YouTube 利用、収益化、クレジット）を確認する
  3. ファイルを渡す
- ローカルなら、ユーザーがダウンロードしたファイルをリポジトリ外のフォルダに置いてもらい、それを読めばよい。
- 受け取ったら「6. 次にやること」の手順 A を実施する。

### 2-2. 背景・テロップの見た目（3案から選んでもらう）

- 「古っぽい」と言われた現行（暗い背景、立入禁止テープ、集中線、太い黒縁テロップ、ハンコ）をやめる方向。
- 見本：`docs/handoff/design-mockups/`

| 案 | 画像 | 雰囲気 |
|---|---|---|
| A クリーン | `A_clean.png` | 明るいグレーの背景に白いカード。字幕は白い吹き出しで、左端の色で話者がわかる。ニュース解説風 |
| B ダーク＋グラデ | `B_dark_gradient.png` | 暗い背景に、すりガラス風のカードとグラデーションの数字。テック系・考察系 |
| C パステル・ポップ | `C_pastel_pop.png` | 淡いグラデーションに白いカードと緑の大きな数字。字幕は白フチの色文字。今どきのずんだもん解説風 |

- `a.html`〜`c.html` は見本の HTML です。フォントと立ち絵はリポジトリ内を相対パスで参照しています。立ち絵は `assets/characters`（Git 管理外）にあります。
- ユーザーには「組み合わせも可」と伝えてある。**まだ回答なし**。

---

## 3. これまでの経緯（ユーザーの指示と対応の時系列）

1. **最初の依頼**：パイプラインを作り、第1回の動画を完成させる。
   - ★の段階で止めて確認を受ける。
   - 構成・守ることの元になった依頼は `CLAUDE.md` に要約済み。
2. **★1回目（台本と出典表の確認）**：「全体的にダサい、面白くない」と言われた。
   - 見た目をバラエティ番組風に作り直した（暗い舞台、太いテロップ、ハンコ、集中線、メーター故障の演出）。
   - 台本を掛け合い中心に書き直した。ずんだもん＝お金に目がないボケ、めたん＝ツッコミ。
   - 繰り返しの笑いを入れた：うまい棒換算、メーターが振り切れて壊れる、「東芝に就職」→「キオクシアに就職」のオチ。
   - 効果音を ffmpeg で自作した。
   - 事実確認をやり直した。
3. **「サンプル動画見れない？」**：見せ場をつなぐ `highlight.ts`（`npm run sample`）を作った。
4. **「声入りで、BGMも」**：
   - Docker で VOICEVOX を起動し、全セリフを合成した。
   - 合成前に読みを点検し、誤読は読み替え辞書で直した。
   - 実測8分42秒だったので、速度1.33と台本の削りで7分44秒にした。
   - BGM は自作（コードで作曲・合成、ダッキングあり）。音量は loudnorm で −16 LUFS。
   - この状態で `out.mp4` / `out_no_audio.mp4` を書き出した（品質チェック済み）。
5. **「キャラが立って喋る形にできないの？」**：
   - 公式サイト zunko.jp の規約を確認した（「8. 規約」）。
   - **ユーザーは A＝語り口を解説寄りに調整して続行、を選択**。
   - 公式イラストの立ち絵対応（`characterStyle: "image"`）を入れた。
6. **「ダサい、古っぽい」**：見た目の見本3案（A/B/C）を作成した。→ **回答待ち**
7. **「公式はあまり見ない、体ゴツい」**：よく見る立ち絵は二次創作であることを説明した。
8. **「あなたが二次創作のイラストを作ろう」**：SVG で部品式の立ち絵を自作した（`characterStyle: "chibi"`、いまの既定）。
   - 口は音声連動で開閉し、まばたきと表情差分がある。
9. **「可愛くない、もう少し立体的に。よく使われてるのと同じ感じに」**：描き直した（瞳・ツヤ・影）。
10. **「イマイチ。素材ファイル集めて」**：ログインが必要なため取得不可と説明し、ユーザーにダウンロードを依頼した。→ **回答待ち**
11. **この引き継ぎ書を作成**。

---

## 4. 作成物の一覧

### 4-1. Git に入っているもの

| パス | 内容 |
|---|---|
| `CLAUDE.md` | シリーズの方針・守ること・手順・script.json の書き方 |
| `package.json` | `npm run check / tts / timeline / render / stills / sample / docs / make / studio` |
| `scripts/lib.ts` | 共通関数（WAV 読み書き、読み替え辞書 `SERIES_READINGS`、`toSpeech`） |
| `scripts/check-script.ts` | 台本検査（出典 ID、数値ごとの出典、字幕の長さ、禁止語、尺の見積もり） |
| `scripts/tts.ts` | VOICEVOX で全セリフを合成。話者 ID は `/speakers` から名前とスタイルで引く。キャッシュあり。`--silent` で無音代用 |
| `scripts/build-timeline.ts` | wav の長さから `timeline.json` を作る。ほかに次の処理もする：<br>・`narration.wav`（全セリフ1本）の作成<br>・口パク用の音量トラック（`mouth`）の作成<br>・BGM・効果音・立ち絵の写し |
| `scripts/render.ts` | `out.mp4` と `out_no_audio.mp4` を作る。<br>・loudnorm で音量をそろえ、尺を検査する<br>・`--stills=ch5-s2@last` で確認用の静止画を出す |
| `scripts/highlight.ts` | 見せ場をつないだ `sample.mp4`（`--clips=ch0-s1:0-6,...`） |
| `scripts/make-docs.ts` | `script.md`、`sources.md`、`credits.json`、`description.txt`、`subtitles.srt`（YouTube 字幕）を作る |
| `scripts/make.ts` | 上の手順を一括実行 |
| `scripts/studio.ts` | Remotion Studio でプレビュー |
| `scripts/make-sfx.ts` | 効果音5種を ffmpeg で合成 → `assets/sfx/`（wav も Git 管理） |
| `scripts/make-bgm.ts` | BGM を合成 → `assets/bgm/yarakashi-theme.wav`（Git 管理外。build-timeline が無ければ自動生成） |
| `scripts/fetch-characters.ts` | 公式イラスト2枚を zunko.jp から取得 → `assets/characters/`（Git 管理外。`characterStyle: "image"` 用） |
| `remotion/` | Remotion 4.0.543 のプロジェクト（`npx create-video` で作成）。<br>・`src/Episode.tsx`：本体<br>・`src/Root.tsx`：Episode と CharacterSheet の登録<br>・`src/scenes/*`：title, timeline, bigNumber, barChart, transferMap, quote, meter<br>・`src/components/*`：Chrome（背景・ヘッダー・フリップ・出典）、Subtitle、Characters、Chibi、Fx、FontLoader<br>・`src/sfx.ts`：効果音のタイミング<br>・`src/theme.ts`：配色<br>・`src/types.ts`：型 |
| `.claude/agents/fact-checker.md` | 事実確認サブエージェント（台本を書いた流れとは別のコンテキストで使う） |
| `.claude/skills/remotion-*` | Remotion 公式 Agent Skills（`npx skills add remotion-dev/skills`） |
| `episodes/001-toshiba/research.md` | 調査メモ。出典 src-01〜70、事実 F-NNN、確認レベル、**公開前に一次資料で照合すべき項目の一覧** |
| `episodes/001-toshiba/script.json` | 台本（9章・37シーン・113セリフ、読み上げ速度1.33） |
| `episodes/001-toshiba/script.md` / `sources.md` | 人が読む用の台本／事実と出典の対応表 |
| `episodes/001-toshiba/factcheck.md` / `factcheck-v2.md` | 事実確認の報告2回分と、各指摘への対応表 |
| `episodes/001-toshiba/credits.json` / `description.txt` / `subtitles.srt` | クレジット、概要欄（チャプター付き）、字幕 |
| `episodes/001-toshiba/timeline.json` / `audio/manifest.json` | 最新の台本から作ったタイムラインと、音声の長さの記録 |
| `docs/handoff/` | この文書、見た目の見本3案、立ち絵の画像（自作版）、旧デザインの確認画像 |

### 4-2. Git に入っていないもの（作り直せる）

| パス | 作り方 | 備考 |
|---|---|---|
| `episodes/001-toshiba/out.mp4`（171MB）/ `out_no_audio.mp4` | `npm run render -- episodes/001-toshiba` | GitHub の100MB上限を超えるため管理外。<br>**クラウドで書き出したのは古い版**：バラエティ風＋丸アイコン、調整前の語り口、7分44秒。<br>ユーザーにはチャットで送付済み |
| `sample.mp4` / `preview_opening.mp4` | `npm run sample -- episodes/001-toshiba` | 古い版 |
| `episodes/001-toshiba/audio/*.wav` | `npm run tts -- episodes/001-toshiba` | VOICEVOX が必要。manifest は Git にあるが、wav が無ければ作り直される |
| `assets/bgm/*.wav` | `node scripts/make-bgm.ts`（build-timeline が自動実行） | |
| `assets/characters/*.png` | `node scripts/fetch-characters.ts` | 公式イラスト。再配布を避けるため管理外 |
| `episodes/*/bgm`, `sfx`, `characters` | build-timeline が `assets/` から写す | Remotion の public フォルダとして使う |
| `episodes/*/stills/` | `npm run stills -- episodes/001-toshiba` | |

---

## 5. ローカルでの準備

前提：Node.js 22.18 以上（`.ts` をそのまま `node` で実行している＝型ストリップ）、ffmpeg / ffprobe、Docker。

```bash
git fetch origin claude/vibrant-heisenberg-pysqwe
git checkout claude/vibrant-heisenberg-pysqwe
npm run setup                       # = npm --prefix remotion install

# VOICEVOX（イメージ約 2GB）
docker run -d --rm --name voicevox -p 50021:50021 voicevox/voicevox_engine:cpu-latest
curl http://localhost:50021/version  # 0.26.1 で動作確認済み。話者 ID：ずんだもん/ノーマル=3、四国めたん/ノーマル=2

# 任意：公式イラスト（characterStyle を "image" にする場合だけ）
node scripts/fetch-characters.ts

# 通し（検査 → 音声 → タイムライン → 文書 → 書き出し）
npm run make -- episodes/001-toshiba
```

- `REMOTION_BROWSER_EXECUTABLE` は**ローカルでは不要**。クラウドでは remotion.media が遮断されていたため、入っていたブラウザを指定していた。
- 書き出し速度：クラウド（4コア、`REMOTION_CONCURRENCY=4`）で 1 秒あたり約 10 フレーム。8 分の動画で約 23 分。
- Windows で動かす場合：`spawnSync('npx', ...)` に `shell: true` が必要になる可能性がある。mac / Linux 前提で書いている。
- 確認用：
  - 静止画は `npm run stills -- episodes/001-toshiba --stills=ch0-s2@5,ch5-s2@last`
  - 立ち絵の一覧は `cd remotion && npx remotion still CharacterSheet out.png`

---

## 6. 次にやること

### 手順 A：ユーザーの立ち絵 PSD を組み込む（2-1 の回答後）

1. 規約をユーザーと確認し、作者クレジットを `credits.json` の `extra` に入れる（make-docs が保持する）。
2. PSD を読み、部品を書き出す。
   - npm の `ag-psd` などで Node から読み、`assets/characters/<name>/parts/*.png` に書き出す。
   - よく配布されている立ち絵は PSDToolKit のレイヤー名の規約に従っていることが多い。`*` で始まるレイヤーは同じ階層で一つだけ表示、`!` で始まるレイヤーは常に表示。
   - 目（開・半・閉）、口（閉・小・中・大）、眉、表情差分、腕などの候補を一覧にする。
3. 状態とレイヤーの対応表を作る：`assets/characters/<name>/config.json`。
   - 状態は normal / surprised / sad / happy、口 0〜3、まばたき。
4. Remotion 側に `characterStyle: "psd"` を追加し、部品 PNG を重ねて描く。
   - 口の段階：すでに `timeline.json` の各セリフに `mouth`（1フレーム1文字、0〜3）がある。
   - まばたき・跳ね・表情の切り替え：`components/Characters.tsx` の `ChibiStanding` と同じ考え方でよい。
5. 立ち絵の画像は Git に入れない（再配布になる）。取得手順だけを文書に残す。

### 手順 B：見た目を選ばれた案で作り直す（2-2 の回答後）

- 変えるのは主に次のファイル：
  - `remotion/src/theme.ts`（配色・フォント）
  - `components/Chrome.tsx`（背景・ヘッダー・フリップ・出典）
  - `components/Subtitle.tsx`（字幕）
  - `scenes/*`（とくに TitleScene の立入禁止テープ、Fx の集中線とハンコ）
- 今風のフォントとして、Noto Sans JP、Zen Kaku Gothic New、Inter を導入済み（`@fontsource/*`）。`FontLoader.tsx` で読み込みに追加すること。
- 変えたら静止画（各章2〜3枚）をユーザーに見せて確認を取ってから、全編を書き出す。

### 手順 C：最新状態で書き出して報告する

```bash
npm run make -- episodes/001-toshiba
```

その後：
- 品質チェック：各章の静止画を目視、尺の一致（render.ts が検査）、`npm run check`
- `out.mp4` / `out_no_audio.mp4` / `subtitles.srt` / `description.txt` をユーザーに渡す

### 手順 D：公開前の事実の照合（ローカルならネットワークに制限がない）

- クラウドではネットワーク方針で、東芝・JPX・金融庁・EDINET の**本文を1件も開けていない**。すべて検索結果の要約での確認。
- `research.md` 末尾の「公開前に本文で照合すべき項目」を、一次資料の本文で照合する。
  - 優先：2026年度第1四半期と上期の決算の数値、1,518億円と2,248億円、9,657億円、画面に「」で出す引用、売却額、棒グラフの各年度。
  - 「数値が一次資料で確認できない」場合は台本から外す（CLAUDE.md の守ること1）。
- 台本を変えたら、`fact-checker` サブエージェントで再確認する。

---

## 7. 台本（script.json）の拡張仕様

依頼時の形からの拡張点です。詳しくは `CLAUDE.md` と `remotion/src/types.ts` を参照。

- `lines[].text` の `{ }`：黄色の強調テロップ（音声では読まない）
- `lines[].yomi`：音声だけの読み
- `lines[].joke: true`：事実の主張を含まない冗談（数値チェックと出典表の対象外）
- `lines[].emotion`：normal / surprised / sad / happy（表情・記号・跳ねに反映）
- `scene.facts[]`：そのシーンで言っている事実と `sourceIds`（sources.md の元）
- `scene.stamp`：ハンコ演出（今の見た目で使用。見た目を作り直すなら見直す）
- `scene.minDurationSec`、`chapter.color`、`meter.level > 100`（振り切れて「測定不能」）
- `tts`：`speedScale 1.33`、`gapSec 0.15`、`sceneTailSec 0.3`、`readings`（この回だけの読み替え）
- `bgm`、`sfx`、`characterStyle`（`chibi`＝自作 SVG（既定）／`image`＝公式イラスト／`icon`＝丸アイコン）、`bannedWords`（歴代経営者の氏名。個人名が入っていないかの自動検査用）

---

## 8. 規約・ライセンス（ユーザーと確認済みの論点）

- **VOICEVOX ずんだもん・四国めたんの音源規約**
  - 商用・非商用とも可。クレジット「VOICEVOX:ずんだもん」「VOICEVOX:四国めたん」が必須（`credits.json` に入れてある）。
  - 禁止事項に「特定の個人、団体を非難・批判するまたは応援する目的での利用」がある：https://zunko.jp/con_ongen_kiyaku.html
  - 実在企業の失敗を扱うシリーズなので、解釈のリスクがあることをユーザーに説明済み。ユーザーは **A＝解説寄りに語り口を調整して続行** を選んだ。
  - 調整の内容：
    - ハンコ：「爆買い」→「大型買収」、「盛りすぎ」→「要修正」、「大赤字」→「最終赤字」
    - 冒頭とまとめに、学ぶ目的の一言を入れた
    - 概要欄に「特定の企業を非難する目的ではない」と明記した
- **キャラクター（イラスト）の規約**：https://zunko.jp/guideline.html
  - 個人の YouTube（広告収入あり）は非商用の扱い。
  - 企業の商用利用で無償なのは、ずんだもん＝東北、めたん＝四国の企業のみ。
  - 自分で描く二次創作は可。他人の二次創作は、その作者の許可・規約が必要。
- **Remotion**：従業員4名以上の企業で使う場合は有料ライセンスが必要。ユーザーに伝達済み、判断はユーザー。
- **素材**
  - フォント（Fontsource、OFL）
  - 効果音・BGM（自作）
  - 自作 SVG 立ち絵
  - 公式イラスト（zunko.jp から取得、Git 管理外）

---

## 9. 既知の注意点・ハマりどころ

- **読みの点検**：合成前に `audio_query` の `kana` で全セリフの読みを点検すること。
  - 誤読して直した例：「やらかし度」→タビ、「電気釜」→デンキカマ、「市場銘柄に指定」→シテエ、「4〜6月」、「WH」、「右はし」
  - 直し方：シリーズ共通は `SERIES_READINGS`、この回だけは `tts.readings`
- **尺の目安**：速度1.33で 1 秒あたり約7文字。約2,900文字で7分40秒前後。
  - check-script.ts の推定は粗い。VOICEVOX で実測して調整すること。
- **字幕の改行**：句読点・かぎかっこの位置で2行に分け、文字の大きさを自動で決める（`components/Subtitle.tsx`）。
- **ffprobe の CSV 出力**：末尾にカンマが付く。`Number()` では NaN になるので `parseFloat` を使う（render.ts で修正済み）。
- **render.ts の静止画**：`--stills=<シーンID>@<セリフ番号|last>`。1回のレンダリングでまとめて出す。
- **キャラクターの切り替え**：`Characters.tsx` が `timeline.characterStyle` で描き分ける。
  - 自作 SVG は `components/Chibi.tsx`。ユーザー評価は「イマイチ」。コードで描くことの限界と説明済み。
- **クラウド固有のもの（ローカルでは不要）**：
  - 個人用クラウド環境「test_cc」（zunko.jp を許可したもの）
  - Docker デーモンの手動起動
  - `REMOTION_BROWSER_EXECUTABLE`
- **ユーザーとのやり取りの傾向**：
  - 短い一言（「ダサい」など）で方向転換を求めることが多い。
  - 見た目の大きな変更は、先に静止画や見本で確認を取ってから全編に広げると、手戻りが少ない。
