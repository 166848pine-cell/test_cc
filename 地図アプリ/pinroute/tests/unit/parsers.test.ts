import { describe, it, expect } from 'vitest';
import {
  parseGsiResponse,
  parseNominatimResponse,
  buildNominatimContext,
} from '../../src/geocode';
import { parseOsrmResponse, buildGoogleMapsUrl } from '../../src/route';
import type { Pin } from '../../src/types';

describe('geocode.ts パーサ', () => {
  it('UT-G01: parseGsi 正常GeoJSON 3件 → [lon,lat]→{lat,lng}変換', () => {
    const json = [
      {
        geometry: { coordinates: [139.767125, 35.681236] },
        properties: { title: '東京駅', addressCode: '13101', dataSource: '1' },
      },
      {
        geometry: { coordinates: [135.495, 34.702] },
        properties: { title: '梅田', addressCode: '' },
      },
      {
        geometry: { coordinates: [141.353, 43.062] },
        properties: { title: '時計台', addressCode: '' },
      },
    ];
    const r = parseGsiResponse(json);
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual({
      name: '東京駅',
      lat: 35.681236,
      lng: 139.767125,
      source: 'gsi',
      kind: 'poi',
      context: '東京都千代田区',
    });
    expect(r[1].lat).toBe(34.702);
    expect(r[1].lng).toBe(135.495);
  });

  it('UT-G01b: parseGsi addressCodeが空なら住所レベル扱いで所在地なし', () => {
    const r = parseGsiResponse([
      {
        geometry: { coordinates: [139.7, 35.6] },
        properties: { title: '東京都港区六本木', addressCode: '' },
      },
    ]);
    expect(r[0].kind).toBe('address');
    expect(r[0].context).toBeUndefined();
  });

  it('UT-G02: parseGsi 空配列/非配列/null → 空配列', () => {
    expect(parseGsiResponse([])).toEqual([]);
    expect(parseGsiResponse({})).toEqual([]);
    expect(parseGsiResponse(null)).toEqual([]);
    expect(parseGsiResponse('x')).toEqual([]);
    expect(parseGsiResponse([{ geometry: null }])).toEqual([]);
  });

  it('UT-G03: parseNominatim 正常2件 → lat/lon文字列がnumber化、名称と所在地を分離', () => {
    const json = [
      {
        lat: '35.6812',
        lon: '139.7671',
        name: '東京駅',
        display_name:
          '東京駅, 1, 丸の内一丁目, 千代田区, 東京都, 100-0005, 日本',
        category: 'railway',
        importance: 0.6,
      },
      {
        lat: '34.7025',
        lon: '135.4959',
        display_name: '梅田, 北区, 大阪市, 大阪府, 日本',
      },
    ];
    const r = parseNominatimResponse(json);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({
      name: '東京駅',
      lat: 35.6812,
      lng: 139.7671,
      source: 'nominatim',
      kind: 'poi',
      context: '東京都千代田区丸の内一丁目',
      importance: 0.6,
    });
    // name が無い場合は display_name の先頭を名称として使う
    expect(r[1].name).toBe('梅田');
    expect(typeof r[1].lat).toBe('number');
  });

  it('UT-G03b: parseNominatim セミコロン付きの名称は先頭のみ使う', () => {
    const r = parseNominatimResponse([
      {
        lat: '35.0',
        lon: '139.0',
        name: '東京駅;地下2階',
        display_name: '東京駅;地下2階, 千代田区, 日本',
      },
    ]);
    expect(r[0].name).toBe('東京駅');
  });

  it('UT-G04: parseNominatim lat="abc" → 該当要素を除外', () => {
    const json = [
      { lat: 'abc', lon: '139.7', display_name: '不正' },
      { lat: '35.0', lon: '139.0', display_name: '正常' },
    ];
    const r = parseNominatimResponse(json);
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('正常');
  });

  it('UT-G05: buildNominatimContext は国名・郵便番号・地方・番地を除いて都道府県から組み立てる', () => {
    expect(
      buildNominatimContext(
        '札幌市時計台, 北1西2, 狸小路, 中央区, 札幌市, 石狩振興局, 北海道, 北海道地方, 060-0001, 日本',
        '札幌市時計台',
      ),
    ).toBe('北海道札幌市中央区');
    expect(buildNominatimContext('日本', '日本')).toBeUndefined();
  });
});

describe('route.ts パーサ', () => {
  const geometry = {
    type: 'LineString',
    coordinates: [
      [139.767, 35.681],
      [139.62, 35.466],
    ],
  };

  it('UT-R01: parseOsrm code=Ok正常 → 距離km(小数1桁)・分(四捨五入)・geometry', () => {
    const r = parseOsrmResponse({
      code: 'Ok',
      routes: [{ distance: 65432, duration: 4321, geometry }],
    });
    expect(r).not.toBeNull();
    expect(r!.distanceKm).toBe(65.4); // 65432m → 65.4km
    expect(r!.durationMin).toBe(72); // 4321s → 72.0分
    expect(r!.geometry.type).toBe('LineString');
    expect(r!.geometry.coordinates).toHaveLength(2);
  });

  it('UT-R01b: parseOsrm legs → 区間ごとの距離・所要時間', () => {
    const r = parseOsrmResponse({
      code: 'Ok',
      routes: [
        {
          distance: 65432,
          duration: 4321,
          geometry,
          legs: [
            { distance: 32400, duration: 2160 },
            { distance: 33032, duration: 2161 },
            { distance: 'x', duration: 1 },
          ],
        },
      ],
    });
    expect(r!.legs).toEqual([
      { distanceKm: 32.4, durationMin: 36 },
      { distanceKm: 33, durationMin: 36 },
    ]);
  });

  it('UT-R01c: parseOsrm legsが無い応答でも壊れない', () => {
    const r = parseOsrmResponse({
      code: 'Ok',
      routes: [{ distance: 100, duration: 60, geometry }],
    });
    expect(r!.legs).toEqual([]);
  });

  it('UT-R02: parseOsrm code=NoRoute → null', () => {
    expect(parseOsrmResponse({ code: 'NoRoute', routes: [] })).toBeNull();
  });

  it('UT-R03: parseOsrm routes空/不正形状 → null', () => {
    expect(parseOsrmResponse({ code: 'Ok', routes: [] })).toBeNull();
    expect(parseOsrmResponse({ code: 'Ok' })).toBeNull();
    expect(parseOsrmResponse(null)).toBeNull();
    expect(parseOsrmResponse('x')).toBeNull();
    expect(
      parseOsrmResponse({
        code: 'Ok',
        routes: [{ distance: 'x', duration: 1, geometry }],
      }),
    ).toBeNull();
    expect(
      parseOsrmResponse({
        code: 'Ok',
        routes: [{ distance: 1, duration: 1, geometry: {} }],
      }),
    ).toBeNull();
  });

  it('UT-R04: buildGoogleMapsUrl 3件 → /maps/dir/lat,lng/... 順序一致', () => {
    const pins: Pin[] = [
      { id: '1', name: 'A', query: 'a', lat: 35.1, lng: 139.1 },
      { id: '2', name: 'B', query: 'b', lat: 35.2, lng: 139.2 },
      { id: '3', name: 'C', query: 'c', lat: 35.3, lng: 139.3 },
    ];
    expect(buildGoogleMapsUrl(pins)).toBe(
      'https://www.google.com/maps/dir/35.1,139.1/35.2,139.2/35.3,139.3',
    );
  });
});
