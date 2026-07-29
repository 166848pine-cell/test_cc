# PinRoute テスト計画・テストケース v1.0

## 1. テスト方針

| レベル | ツール | 対象 | 外部API |
|---|---|---|---|
| 単体(UT) | Vitest | 純粋関数(state / share / パーサ / throttle / buildGoogleMapsUrl) | 使用しない |
| 結合(IT) | Vitest + fetchモック | geocode / route の通信制御(フォールバック・タイムアウト・レート制御) | モック |
| E2E | Playwright + ルートモック | 画面操作の一連フロー | Playwrightの `page.route` でスタブ |
| 手動(MT) | 人手 | 実API疎通・実機・デプロイ確認 | 実API |

自動テスト(UT/IT/E2E)は実APIに接続しない。CIや再実行で外部サーバーに負荷をかけないため。

## 2. 単体テスト(UT)

### state.ts

| ID | ケース | 期待結果 |
|---|---|---|
| UT-S01 | addPin: 空状態に1件追加 | pins.length=1、idが付与される |
| UT-S02 | addPin: 20件の状態に追加 | 変化なし(21件にならない) |
| UT-S03 | removePin: 存在するid | 該当のみ削除、順序維持 |
| UT-S04 | removePin: 存在しないid | 変化なし |
| UT-S05 | renamePin: 通常文字列 | nameのみ更新 |
| UT-S06 | renamePin: 空文字・空白のみ | 変化なし |
| UT-S07 | movePin: 中間要素を-1 | 1つ前と入れ替わる |
| UT-S08 | movePin: 先頭を-1/末尾を+1 | 変化なし |
| UT-S09 | reorderPin: 0→2(3件) | 順序 [B,C,A] になる |
| UT-S10 | clearPins | pins=[] |
| UT-S11 | 全関数の不変性 | 引数のstateオブジェクトが変異していない |

### share.ts

| ID | ケース | 期待結果 |
|---|---|---|
| UT-H01 | encode→decode ラウンドトリップ(日本語名称・絵文字含む) | name/query/lat/lngが完全一致、idは再発行 |
| UT-H02 | decode: 不正base64 | null(throwしない) |
| UT-H03 | decode: JSONだが型不一致(vなし等) | null |
| UT-H04 | encode: 20件フル(長い名称) | tooLongフラグが正しく判定される |
| UT-H05 | encode: 0件 | 有効URL、decodeで空pins |

### geocode.ts パーサ

| ID | ケース | 期待結果 |
|---|---|---|
| UT-G01 | parseGsi: 正常GeoJSON 3件 | 3件、[lon,lat]→{lat,lng}変換が正しい |
| UT-G02 | parseGsi: 空配列/非配列/null | 空配列 |
| UT-G03 | parseNominatim: 正常2件 | 2件、lat/lon文字列がnumber化 |
| UT-G04 | parseNominatim: lat="abc" | 該当要素を除外 |

### route.ts

| ID | ケース | 期待結果 |
|---|---|---|
| UT-R01 | parseOsrm: code=Ok正常 | distanceKm(小数1桁相当の数値)、durationMin(四捨五入)、geometry取得 |
| UT-R02 | parseOsrm: code=NoRoute | null |
| UT-R03 | parseOsrm: routes空/不正形状 | null |
| UT-R04 | buildGoogleMapsUrl: 3件 | `/maps/dir/lat,lng/lat,lng/lat,lng` 形式・順序一致 |

### throttle.ts

| ID | ケース | 期待結果 |
|---|---|---|
| UT-T01 | debounce: 100ms内に3回呼ぶ | 最後の1回のみ実行(fakeTimers) |
| UT-T02 | rateLimit(1000ms): 連続2回 | 2回目は1秒以上待ってから実行 |

## 3. 結合テスト(IT・fetchモック)

| ID | ケース | モック設定 | 期待結果 |
|---|---|---|---|
| IT-01 | GSIヒット時はNominatimを呼ばない | GSI:2件 | 候補2件、Nominatimのfetch呼び出し回数0 |
| IT-02 | GSI 0件→Nominatimフォールバック | GSI:[]、Nominatim:1件 | 候補1件(source='nominatim') |
| IT-03 | 両API 0件 | 両方:[] | 空配列が返る(E1相当) |
| IT-04 | GSIネットワークエラー→Nominatimへ | GSI:reject、Nominatim:1件 | 候補1件 |
| IT-05 | タイムアウト | GSI:8秒超応答 | GeocodeError(kind='timeout') |
| IT-06 | 候補5件超 | GSI:8件 | 5件に切り詰め |
| IT-07 | fetchRoute正常 | OSRM:Ok | RouteResult返却 |
| IT-08 | fetchRoute異常 | OSRM:500 | RouteError throw |
| IT-09 | Abort | 実行中にsignal.abort | 例外がAbort系として処理される |

## 4. E2Eテスト(Playwright・APIスタブ)

前提:`page.route` で GSI/Nominatim/OSRM/タイル をスタブする(タイルは1x1 png)。

| ID | シナリオ | 期待結果 |
|---|---|---|
| E2E-01 | 検索→単一候補→ピン1件表示 | 一覧に1行、地図にマーカー1個、ルートバー非表示 |
| E2E-02 | 複数候補→2番目を選択 | 選択した座標・名称でピン確定 |
| E2E-03 | 2件登録でルート表示 | ルート線描画、距離・所要時間・Googleマップリンクが表示 |
| E2E-04 | 名称編集 | 一覧とポップアップの名称が更新される |
| E2E-05 | ▲で並び替え | 番号が振り直され、OSRMへのリクエストURLの座標順が入れ替わる |
| E2E-06 | 個別削除→1件になる | ルート線・バーが消える |
| E2E-07 | 全削除(confirm=OK) | 一覧空、localStorageも空状態 |
| E2E-08 | リロード復元 | 3件登録→reload→3件とルートが復元 |
| E2E-09 | 共有URL復元 | 共有URLコピー→新規コンテキストで開く→同一ピン再現、URLフラグメントが除去済み |
| E2E-10 | ルートAPI障害 | OSRMを500に→E3メッセージ表示、ピン操作は継続可能 |
| E2E-11 | 検索0件 | E1メッセージ表示 |
| E2E-12 | ピン20件で追加試行 | E4メッセージ、21件目が追加されない |
| E2E-13 | モバイルビューポート(375x667) | 縦積みレイアウトで E2E-01〜03 相当の操作が完了できる |
| E2E-14 | XSS: 名称に `<img src=x onerror=...>` を入力 | スクリプト非実行(dialogイベント発生なし)、文字列として表示 |

## 5. 手動テスト(MT・実API/実機)

| ID | 内容 | 合格基準 |
|---|---|---|
| MT-01 | 実API疎通:「東京駅」「大阪市北区梅田1丁目」「札幌市時計台」で検索 | いずれもピンが立つ |
| MT-02 | 実OSRM:東京駅→横浜駅→鎌倉でルート | 常識的な経路・距離(60〜80km程度)が表示される |
| MT-03 | Googleマップリンク | 別タブでGoogleマップの経路画面が同順序で開く |
| MT-04 | iOS Safari実機 | 追加・編集・並替(▲▼)・共有コピーが動作 |
| MT-05 | GitHub Pagesデプロイ | `dist/` 配置のURLで全機能動作(パス崩れなし) |
| MT-06 | 帰属表示 | OSM/国土地理院/Nominatim/OSRMの表記が画面に常時見える |
| MT-07 | 機内モード | 操作してもクラッシュせずE2/E3系メッセージ表示 |

## 6. 完了報告

- 全UT/IT/E2Eの実行結果と、MTの実施可否(Claude Code環境で不可能なものは「未実施・要人手」と明記)を `TEST_RESULT.md` に表形式で出力すること
- FAILがある状態で完了としない。仕様上実装不能な項目があれば理由を添えて報告すること
