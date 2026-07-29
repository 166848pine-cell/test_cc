import type { Page } from '@playwright/test';

/** 1x1透明PNG(タイルスタブ用) */
const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export interface GeoStubPoint {
  title: string;
  lon: number;
  lat: number;
  /** 国土地理院の市区町村コード。施設・駅などの地点にだけ付く。 */
  addressCode?: string;
}

export const TOKYO: GeoStubPoint = {
  title: '東京駅',
  lon: 139.767125,
  lat: 35.681236,
  addressCode: '13101',
};
export const YOKOHAMA: GeoStubPoint = {
  title: '横浜駅',
  lon: 139.622,
  lat: 35.466,
  addressCode: '14103',
};
export const KAMAKURA: GeoStubPoint = {
  title: '鎌倉駅',
  lon: 139.55,
  lat: 35.319,
  addressCode: '14204',
};

/**
 * 国土地理院APIが実際に返す並び順を再現したスタブ。
 * 「東京駅」で検索しても「東」の部分一致が先頭に並び、本命は配列の末尾に来る。
 */
export const TOKYO_NOISE: GeoStubPoint[] = [
  { title: '北海道札幌市東区', lon: 141.363617, lat: 43.076111 },
  { title: '北海道東神楽町東', lon: 142.432129, lat: 43.681801 },
  { title: '茨城県つくば市東', lon: 140.13031, lat: 36.061123 },
  { title: '東京都渋谷区東', lon: 139.708405, lat: 35.655392 },
  { title: '大阪府堺市東区', lon: 135.536514, lat: 34.538174 },
  TOKYO,
];

/** GSI/Nominatim/OSRM/OSMタイルをスタブする。 */
export async function stubApis(
  page: Page,
  opts?: {
    gsiByQuery?: Record<string, GeoStubPoint[]>;
    nominatimByQuery?: Record<string, GeoStubPoint[]>;
    osrmStatus?: number;
    osrmUrls?: string[];
  },
): Promise<void> {
  await page.route('https://cyberjapandata.gsi.go.jp/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TILE_PNG }),
  );

  await page.route('https://msearch.gsi.go.jp/**', (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get('q') ?? '';
    const points = opts?.gsiByQuery?.[q] ?? [];
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        points.map((p) => ({
          geometry: { coordinates: [p.lon, p.lat] },
          properties: {
            title: p.title,
            addressCode: p.addressCode ?? '',
            ...(p.addressCode === undefined ? {} : { dataSource: '1' }),
          },
        })),
      ),
    });
  });

  await page.route('https://nominatim.openstreetmap.org/**', (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get('q') ?? '';
    const points = opts?.nominatimByQuery?.[q] ?? [];
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        points.map((p) => ({
          lat: String(p.lat),
          lon: String(p.lon),
          name: p.title,
          display_name: `${p.title}, 日本`,
          category: 'tourism',
          importance: 0.5,
        })),
      ),
    });
  });

  await page.route('https://router.project-osrm.org/**', (route) => {
    opts?.osrmUrls?.push(route.request().url());
    if ((opts?.osrmStatus ?? 200) !== 200) {
      route.fulfill({ status: opts?.osrmStatus ?? 500, body: '{}' });
      return;
    }
    const m = /driving\/([^?]+)/.exec(route.request().url());
    const coords = (m?.[1] ?? '')
      .split(';')
      .map((s) => s.split(',').map(Number) as [number, number]);
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'Ok',
        routes: [
          {
            distance: 65000,
            duration: 4200,
            geometry: { type: 'LineString', coordinates: coords },
            legs: Array.from(
              { length: Math.max(coords.length - 1, 0) },
              () => ({
                distance: 65000 / Math.max(coords.length - 1, 1),
                duration: 4200 / Math.max(coords.length - 1, 1),
              }),
            ),
          },
        ],
      }),
    });
  });
}

/** まとめて入力で使う、住所を含む物件表のスタブ。 */
export const PROPERTY_ROWS: {
  name: string;
  address: string;
  walk: string;
  rent: string;
  point: GeoStubPoint;
}[] = [
  {
    name: 'グランドメゾン新宿',
    address: '東京都新宿区西新宿2-8-1',
    walk: '新宿駅 徒歩8分',
    rent: '24.8万円',
    point: {
      title: '東京都新宿区西新宿二丁目8番',
      lon: 139.69177,
      lat: 35.68963,
      addressCode: '13104',
    },
  },
  {
    name: 'パークレジデンス渋谷',
    address: '東京都渋谷区神南1-19-11',
    walk: '渋谷駅 徒歩5分',
    rent: '31.2万円',
    point: {
      title: '東京都渋谷区神南一丁目19番11号',
      lon: 139.69945,
      lat: 35.66293,
      addressCode: '13113',
    },
  },
  {
    name: '青山ハイツ',
    address: '東京都港区北青山3-6-1',
    walk: '表参道駅 徒歩4分',
    rent: '19.5万円',
    point: {
      title: '東京都港区北青山三丁目6番1号',
      lon: 139.7118,
      lat: 35.6655,
      addressCode: '13103',
    },
  },
];

/** 上の物件表をタブ区切りのテキストにする。 */
export function propertyTsv(): string {
  return [
    ['物件名', '住所', '駅徒歩', '賃料'].join('\t'),
    ...PROPERTY_ROWS.map((r) => [r.name, r.address, r.walk, r.rent].join('\t')),
  ].join('\n');
}

/** 物件表の住所をGSIのスタブ設定に変換する。 */
export function propertyGsiStub(): Record<string, GeoStubPoint[]> {
  const out: Record<string, GeoStubPoint[]> = {};
  for (const r of PROPERTY_ROWS) out[r.address] = [r.point];
  return out;
}

/** 検索してピンを1件追加する(単一候補で即確定するスタブ前提)。 */
export async function addPinBySearch(page: Page, query: string): Promise<void> {
  await page.fill('#addr-input', query);
  await page.click('#add-btn');
}
