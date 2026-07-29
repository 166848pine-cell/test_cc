# PinRoute 詳細設計書 v1.0

## 1. ディレクトリ構成

```
pinroute/
├── index.html
├── vite.config.ts          # base: './'
├── package.json
├── src/
│   ├── main.ts             # 起動・DOM組み立て・イベント配線のみ
│   ├── state.ts            # 状態管理(純粋関数)
│   ├── geocode.ts          # GSI/Nominatim 呼び出し+パーサ
│   ├── route.ts            # OSRM 呼び出し+パーサ
│   ├── share.ts            # 共有URLエンコード/デコード
│   ├── storage.ts          # localStorage 読み書き
│   ├── mapview.ts          # Leaflet ラッパー(マーカー・ポリライン・fitBounds)
│   ├── ui.ts               # パネルDOM描画(一覧・候補・メッセージ)
│   ├── throttle.ts         # debounce / rateLimit ユーティリティ
│   └── style.css
├── tests/
│   ├── unit/               # Vitest
│   └── e2e/                # Playwright
└── README.md
```

設計原則:`state.ts` / `share.ts` / `throttle.ts` と各パーサは**副作用なしの純粋関数**とし、単体テスト可能にする。fetch・DOM・Leafletへの依存は `geocode.ts` / `route.ts` の通信部と `mapview.ts` / `ui.ts` に隔離する。

## 2. モジュール別インターフェース

### 2.1 state.ts

```ts
export function addPin(state: AppState, pin: Omit<Pin, 'id'>): AppState;   // 上限20件。超過時はそのまま返し、呼び出し側で通知
export function removePin(state: AppState, id: string): AppState;
export function renamePin(state: AppState, id: string, name: string): AppState; // nameはtrim。空文字なら変更しない
export function movePin(state: AppState, id: string, dir: -1 | 1): AppState;    // 端では変化なし
export function reorderPin(state: AppState, fromIdx: number, toIdx: number): AppState; // D&D用
export function clearPins(state: AppState): AppState;
export const MAX_PINS = 20;
```

すべて新しいAppStateを返すイミュータブル実装。

### 2.2 geocode.ts

```ts
export interface GeoCandidate { name: string; lat: number; lng: number; source: 'gsi' | 'nominatim'; }

export function parseGsiResponse(json: unknown): GeoCandidate[];        // 純粋関数。不正形状は空配列
export function parseNominatimResponse(json: unknown): GeoCandidate[]; // 同上。lat/lonの文字列→number変換、NaNは除外

export async function searchAddress(query: string, opts?: { signal?: AbortSignal }): Promise<GeoCandidate[]>;
// 仕様: GSI→(0件なら)Nominatim。各8秒タイムアウト。Nominatimは rateLimit(1000ms) を通す。
// 候補は最大5件に切り詰めて返す。通信エラーは GeocodeError を throw(kind: 'network' | 'timeout')
```

### 2.3 route.ts

```ts
export interface RouteResult { distanceKm: number; durationMin: number; geometry: GeoJSON.LineString; }

export function parseOsrmResponse(json: unknown): RouteResult | null;  // code !== 'Ok' や不正形状は null
export async function fetchRoute(pins: Pin[], opts?: { signal?: AbortSignal }): Promise<RouteResult>;
// pins.length < 2 は呼び出し禁止(呼び出し側でガード)。失敗は RouteError を throw
export function buildGoogleMapsUrl(pins: Pin[]): string;               // 純粋関数
```

### 2.4 share.ts

```ts
export function encodeShareUrl(state: AppState, baseUrl: string): { url: string; tooLong: boolean }; // tooLong = url.length > 2000
export function decodeSharePayload(payload: string): AppState | null;  // 失敗は null(throwしない)。idは再発行
```

base64url実装:`btoa` 系ではなく `TextEncoder`/`TextDecoder` + 手動base64url変換(マルチバイト安全)。

### 2.5 storage.ts

```ts
export function saveState(state: AppState): void;   // 300msデバウンスは呼び出し側(main.ts)で適用
export function loadState(): AppState | null;       // パース失敗・v不一致は null
```

### 2.6 throttle.ts

```ts
export function debounce<T extends (...a: any[]) => void>(fn: T, ms: number): T;
export function rateLimit<T extends (...a: any[]) => Promise<any>>(fn: T, intervalMs: number): T; // 前回実行からintervalMs未満なら待ってから実行
```

### 2.7 mapview.ts

```ts
export interface MapView {
  renderPins(pins: Pin[]): void;        // 既存マーカー全削除→番号順に再生成
  renderRoute(r: RouteResult | null): void; // nullで線を消す
  fitToPins(pins: Pin[]): void;         // 0件:何もしない/1件:setView(zoom15)/2件以上:fitBounds(padding40)
}
export function createMapView(el: HTMLElement): MapView;
```

### 2.8 ui.ts

役割:パネル内DOMの再描画とイベントのコールバック化。`main.ts` から渡されるハンドラ(onSearch, onSelectCandidate, onRename, onMove, onReorder, onDelete, onClear, onShare)のみを呼ぶ。DOM文字列組み立て時は必ず `escapeHtml` を通す(NFR-12)。

## 3. main.ts の制御フロー

```
init:
  state = decodeSharePayload(location.hash) ?? loadState() ?? empty
  location.hashに共有payloadがあった場合は history.replaceState でフラグメント除去
  mapview生成 → render(state)

update(newState):
  state = newState
  ui.renderList(state) / mapview.renderPins(state.pins) / mapview.fitToPins(...)
  debouncedSave(state)
  debouncedRoute(state)   // 500ms。実行時に前回AbortControllerをabort

debouncedRoute:
  pins < 2 → mapview.renderRoute(null); routeBar非表示
  それ以外 → fetchRoute → 成功: renderRoute+バー更新+gmap-link更新 / 失敗: renderRoute(null)+msg表示
```

## 4. D&D仕様(FR-05)

- HTML5 Drag and Drop API(`draggable="true"`、dragstart/dragover/drop)
- モバイルはD&D非対応環境があるため▲▼ボタンを常時併設(D&Dは強化手段、▲▼が保証手段)
- drop確定時のみ `reorderPin` を呼ぶ(dragover中はプレビュー用CSSのみ)

## 5. 広告プレースホルダ(NFR-13)

- `index.html` に `<div id="ad-slot" hidden></div>` を配置(PC:パネル最下部/モバイル:パネル下端)
- 将来AdSense導入時は `ad-slot` の中身とスクリプトタグを差すだけで済むよう、レイアウトは `ad-slot` の表示/非表示どちらでも崩れないこと

## 6. エラー処理一覧

| # | 事象 | 検知 | 画面挙動 | メッセージ |
|---|---|---|---|---|
| E1 | ジオコーディング0件 | 両API空配列 | 候補非表示 | 「見つかりませんでした。表記を変えて試してください。」 |
| E2 | ジオコーディング通信失敗 | fetch reject / timeout | 同上 | 「検索サーバーに接続できません。時間をおいて再試行してください。」 |
| E3 | ルート計算失敗 | OSRM異常/通信失敗 | ルート線・バー消去。ピンは維持 | 「ルートを計算できませんでした(無料サーバーのため一時的に不安定なことがあります)。」 |
| E4 | ピン上限超過 | addPin前チェック | 追加せず | 「ピンは最大20件までです。」 |
| E5 | 共有URLデコード失敗 | decode null | 空状態で起動 | 「共有URLを読み込めませんでした。」 |
| E6 | localStorage破損 | load null | 空状態で起動 | 表示なし(サイレント破棄) |
| E7 | クリップボード失敗 | writeText reject | URLをテキスト表示して手動コピー可能に | 「コピーできませんでした。以下のURLを選択してコピーしてください。」 |
| E8 | 共有URLが2000字超 | encode結果 | 発行は行う | 「URLが長いため、一部の環境で開けない場合があります。」 |

メッセージは `msg-area` に表示し、次の操作開始時にクリアする。

## 7. コーディング規約(要点)

- TypeScript strict、`any` 禁止(unknown+型ガードで受ける)
- 外部APIレスポンスは必ずパーサ関数(純粋関数)を通し、UI層に生JSONを渡さない
- 例外は各層で捕捉し、`main.ts` より上に未捕捉例外を漏らさない
