# PinRoute 実装指示書(Claude Code向けエントリポイント)

このリポジトリ(または作業ディレクトリ)で、以下のドキュメント一式に従いWebアプリ「PinRoute」を実装せよ。

## ドキュメント構成と読む順序

1. `01_requirements.md` — 要件定義書(何を作るか・作らないか)
2. `02_basic_design.md` — 基本設計書(画面・アーキテクチャ・外部API仕様・データ設計)
3. `03_detailed_design.md` — 詳細設計書(モジュール分割・関数IF・状態管理・エラー処理)
4. `04_test_spec.md` — テスト計画・テストケース(単体/結合/E2E/手動)

要件定義書が最上位。設計書と要件が矛盾する場合は要件定義書を優先し、矛盾箇所を報告すること。

## 技術スタック(固定)

| 項目 | 採用 | 備考 |
|---|---|---|
| ビルド | Vite | |
| 言語 | TypeScript(strict) | |
| UI | 素のDOM操作(フレームワーク不使用) | 依存最小化のため。React等は導入しない |
| 地図 | Leaflet 1.9系 | |
| 単体・結合テスト | Vitest + happy-dom | fetchはモックする |
| E2Eテスト | Playwright | chromium + mobile viewport |
| Lint/Format | ESLint + Prettier | デフォルト設定でよい |
| ホスティング前提 | GitHub Pages(静的配信) | サーバーサイド処理は一切なし |

## 実装順序

1. プロジェクト雛形(Vite + TS + Vitest + Playwright)を作成し、`npm run dev` / `npm run test` / `npm run build` が通る状態にする
2. 純粋ロジック層を先に実装しテストを書く(`state.ts` → `share.ts` → `geocode.ts` のパーサ部 → `route.ts` のパーサ部)
3. API通信層(fetchラッパー、フォールバック、レート制御)
4. UI層(パネル・地図・マーカー・ルート描画)
5. localStorage永続化と共有URL復元
6. E2Eテスト
7. `04_test_spec.md` の全ケースを実行し、結果表(PASS/FAIL)を `TEST_RESULT.md` に出力

## Definition of Done

- [ ] `04_test_spec.md` のUT/IT/E2E全ケースがPASS
- [ ] `npm run build` が警告なしで成功し、`dist/` をそのままGitHub Pagesに置けば動く(相対パス設定 `base: './'`)
- [ ] APIキー・環境変数・サーバーサイド処理がゼロ
- [ ] モバイル幅(375px)で全機能が操作可能
- [ ] README.md(セットアップ、開発、テスト、デプロイ手順)を生成済み

## 禁止事項

- 有料API・APIキーが必要なサービスの使用(Google Maps Platform含む)
- 外部への利用者データ送信(ジオコーディング/ルートAPIへのクエリ送信を除く)
- `<form>` のsubmitに依存した実装(SPAとして完結させる)
- ドキュメントに定義のない機能の追加実装(提案は `PROPOSALS.md` に書き、実装はしない)
