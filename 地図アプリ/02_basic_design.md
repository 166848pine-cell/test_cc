# PinRoute 基本設計書 v1.0

## 1. システム構成

```
[ブラウザ(静的SPA)]
   ├── OpenStreetMap タイルサーバー(地図画像)
   ├── 国土地理院 AddressSearch API(ジオコーディング第1候補)
   ├── Nominatim(ジオコーディング第2候補・フォールバック)
   └── OSRM デモサーバー(車ルート計算)
```

- サーバーサイドなし。全処理はクライアントJSで完結
- 配信:GitHub Pages(`dist/` を配置)。Viteの `base: './'` で相対パス化

## 2. 画面設計

### 2.1 レイアウト

PC(幅 > 700px):
```
+--------------------------------------------------+
| ヘッダー: PinRoute / 一行説明                     |
+-------------+------------------------------------+
| パネル(340px)|                                    |
|  検索ボックス |                                    |
|  候補リスト   |            地図(Leaflet)           |
|  ピン一覧    |                                    |
|  ルート概要バー|                                    |
|  [広告枠※初期非表示]                              |
+-------------+------------------------------------+
| フッター: 帰属表示・データ送信の注記               |
+--------------------------------------------------+
```

モバイル(幅 ≤ 700px):地図(上・55%)/パネル(下・45%)の縦積み。ヘッダー・フッターは同一。

### 2.2 画面要素一覧

| 要素ID | 種別 | 内容・挙動 |
|---|---|---|
| addr-input | text input | 住所・施設名入力。Enterで検索実行 |
| add-btn | button | 「検索」。検索中はdisabled+「検索中…」 |
| candidates | list | FR-02の候補(最大5件)。クリックで確定しピン追加。Escまたは×で閉じる |
| pin-list | list | 番号・名称(インライン編集input)・元クエリ・▲▼・削除×。D&D対応 |
| route-bar | bar | 「車ルート/距離 xx.x km/所要 xx 分」。ピン<2件時は非表示 |
| gmap-link | anchor | 「Googleマップで開く」。FR-08。ピン≥2件で表示 |
| clear-btn | button | 「全削除」。confirm後に全消去 |
| share-btn | button | 「共有URLをコピー」。クリップボードにコピーし「コピーしました」トースト |
| msg-area | text | エラー・案内メッセージ表示領域 |
| ad-slot | div | NFR-13の広告プレースホルダ。`display:none` 初期値 |
| map | div | Leaflet地図。番号付きマーカー+ルートポリライン |

### 2.3 マーカー・ルートの表示仕様

- マーカー:円形divIcon、直径28px、背景 `#E4572E`、白文字で一覧順の番号。ポップアップに名称+元クエリ
- ルート線:`#E4572E`、weight 5、opacity 0.85
- ピン追加・並び替え時は全ピンが収まるよう `fitBounds`(padding 40px)

## 3. 外部API仕様

### 3.1 国土地理院 AddressSearch(第1候補)

- `GET https://msearch.gsi.go.jp/address-search/AddressSearch?q={encodeURIComponent(query)}`
- レスポンス:GeoJSON Feature配列。`geometry.coordinates = [lon, lat]`、`properties.title = 名称`
- 0件配列 → Nominatimへフォールバック
- タイムアウト:8秒(AbortController)

### 3.2 Nominatim(第2候補)

- `GET https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=ja&q={query}`
- レスポンス:配列。`lat` / `lon`(文字列)、`display_name`
- **1req/秒のスロットリング必須**(前回呼び出しから1秒未満なら待機)
- 0件 → 「見つかりません」処理

### 3.3 OSRM(ルート)

- `GET https://router.project-osrm.org/route/v1/driving/{lon,lat;lon,lat;...}?overview=full&geometries=geojson`
- レスポンス:`code === "Ok"` のとき `routes[0]` を使用。`distance`(m)、`duration`(秒)、`geometry`(GeoJSON LineString)
- 失敗時:ルート線と概要バーを消し、msg-areaに通知。ピン機能は継続(NFR-06)
- 呼び出しはデバウンス500ms+実行中リクエストのAbort

### 3.4 地図タイル

- `https://tile.openstreetmap.org/{z}/{x}/{y}.png`、maxZoom 19、attribution必須

## 4. データ設計

### 4.1 型定義

```ts
interface Pin {
  id: string;       // crypto.randomUUID()
  name: string;     // 表示名(編集可)
  query: string;    // 検索時の元入力
  lat: number;
  lng: number;
}

interface AppState {
  v: 1;             // スキーマバージョン
  pins: Pin[];      // 並び順=ルート順
}
```

### 4.2 localStorage

- キー:`pinroute:state`
- 値:`JSON.stringify(AppState)`
- 保存タイミング:pins変更のたび(デバウンス300ms)
- 読み込み:起動時。パース失敗・バージョン不一致時は破棄して空状態で起動(クラッシュさせない)

### 4.3 共有URL

- 形式:`{origin}{path}#s={payload}`
- payload:`AppState` をJSON化 → UTF-8バイト列 → base64url。復元は逆順。`id` は復元時に再発行
- 起動時に `#s=` があればlocalStorageより**優先**して復元し、復元後にフラグメントを除去(history.replaceState)
- デコード失敗時:エラーメッセージ表示+空状態で起動
- 2,000文字超の場合:発行はするが警告文言を併せて表示(要件§5)

## 5. 処理フロー(主要)

### 5.1 地点検索〜ピン確定

```
入力確定
 → GSI呼び出し
    → 1件: 即ピン確定
    → 2件以上: 上位5件を候補表示 → 利用者選択 → ピン確定
    → 0件: Nominatim呼び出し(1req/s制御)
        → 1件: 即確定 / 2件以上: 候補表示 / 0件: 「見つかりません」
 → ピン確定後: 一覧再描画・マーカー再描画・fitBounds・ルート再計算(§5.2)・保存
```

### 5.2 ルート再計算

```
pins変更イベント
 → 500msデバウンス
 → pins.length < 2 ? ルート消去・バー非表示 : OSRM呼び出し(旧リクエストAbort)
 → 成功: ポリライン描画・距離/時間更新・Googleマップリンク更新
 → 失敗: ルート消去・エラーメッセージ
```

### 5.3 Googleマップリンク(FR-08)

- `https://www.google.com/maps/dir/{lat,lng}/{lat,lng}/...`(ピン順に連結、`target="_blank" rel="noopener"`)
- APIではなく通常のリンク遷移のため無料・キー不要

## 6. エラーメッセージ方針

- すべて日本語・原因と次の行動が分かる文言(詳細一覧は詳細設計書§6)
- ネットワーク断・API障害でも操作不能にならないこと(NFR-09)
